package librarypanels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister,
	libraryElementService libraryelements.Service, folderService folder.Service) (*LibraryPanelService, error) {
	lps := LibraryPanelService{
		Cfg:                   cfg,
		SQLStore:              sqlStore,
		RouteRegister:         routeRegister,
		LibraryElementService: libraryElementService,
		FolderService:         folderService,
		log:                   log.New("library-panels"),
	}

	if err := folderService.RegisterService(lps); err != nil {
		return nil, err
	}

	return &lps, nil
}

// Service is a service for operating on library panels.
type Service interface {
	ConnectLibraryPanelsForDashboard(c context.Context, signedInUser identity.Requester, dash *dashboards.Dashboard) error
	ImportLibraryPanelsForDashboard(c context.Context, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error
	GetPanelModelByUID(c context.Context, signedInUser identity.Requester, uid string) (map[string]interface{}, error)
}

type LibraryInfo struct {
	Panels        []*any
	LibraryPanels *simplejson.Json
}

// LibraryPanelService is the service for the Panel Library feature.
type LibraryPanelService struct {
	Cfg                   *setting.Cfg
	SQLStore              db.DB
	RouteRegister         routing.RouteRegister
	LibraryElementService libraryelements.Service
	FolderService         folder.Service
	log                   log.Logger
}

var _ Service = (*LibraryPanelService)(nil)

// ConnectLibraryPanelsForDashboard loops through all panels in dashboard JSON and connects any library panels to the dashboard.
func (lps *LibraryPanelService) ConnectLibraryPanelsForDashboard(c context.Context, signedInUser identity.Requester, dash *dashboards.Dashboard) error {
	panels := dash.Data.Get("panels").MustArray()
	libraryPanels := make(map[string]string)
	err := connectLibraryPanelsRecursively(c, panels, libraryPanels)
	if err != nil {
		return err
	}

	elementUIDs := make([]string, 0, len(libraryPanels))
	for libraryPanel := range libraryPanels {
		elementUIDs = append(elementUIDs, libraryPanel)
	}

	return lps.LibraryElementService.ConnectElementsToDashboard(c, signedInUser, elementUIDs, dash.ID)
}

// GetPanelModelByUID returns the stored panel model JSON for a library panel UID
// as a generic map[string]any by using the library elements service.
func (lps *LibraryPanelService) GetPanelModelByUID(c context.Context, signedInUser identity.Requester, uid string) (map[string]interface{}, error) {
	if strings.TrimSpace(uid) == "" {
		return nil, errors.New("library panel uid is empty")
	}

	element, err := lps.LibraryElementService.GetElement(c, signedInUser, model.GetLibraryElementCommand{UID: uid, FolderName: dashboards.RootFolderName})
	if err != nil {
		return nil, err
	}

	var panelModel map[string]interface{}
	if len(element.Model) == 0 {
		return map[string]interface{}{}, nil
	}
	if err := json.Unmarshal(element.Model, &panelModel); err != nil {
		return nil, err
	}
	return panelModel, nil
}

func isLibraryPanelOrRow(panel *simplejson.Json, panelType string) bool {
	return panel.Interface() != nil || panelType == "row"
}

func connectLibraryPanelsRecursively(c context.Context, panels []any, libraryPanels map[string]string) error {
	for _, panel := range panels {
		panelAsJSON := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJSON.Get("libraryPanel")
		panelType := panelAsJSON.Get("type").MustString()
		if !isLibraryPanelOrRow(libraryPanel, panelType) {
			continue
		}

		// we have a row
		if panelType == "row" {
			rowPanels := panelAsJSON.Get("panels").MustArray()
			err := connectLibraryPanelsRecursively(c, rowPanels, libraryPanels)
			if err != nil {
				return err
			}
			continue
		}

		// we have a library panel
		UID := libraryPanel.Get("uid").MustString()
		if len(UID) == 0 {
			return errLibraryPanelHeaderUIDMissing
		}
		_, exists := libraryPanels[UID]
		if !exists {
			libraryPanels[UID] = UID
		}
	}

	return nil
}

// ImportLibraryPanelsForDashboard loops through all panels in dashboard JSON and creates any missing library panels in the database.
func (lps *LibraryPanelService) ImportLibraryPanelsForDashboard(c context.Context, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error {
	return importLibraryPanelsRecursively(c, lps.LibraryElementService, signedInUser, libraryPanels, panels, folderID, folderUID)
}

func importLibraryPanelsRecursively(c context.Context, service libraryelements.Service, signedInUser identity.Requester, libraryPanels *simplejson.Json, panels []any, folderID int64, folderUID string) error {
	for _, panel := range panels {
		panelAsJSON := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJSON.Get("libraryPanel")
		panelType := panelAsJSON.Get("type").MustString()
		if !isLibraryPanelOrRow(libraryPanel, panelType) {
			continue
		}

		// we have a row
		if panelType == "row" {
			err := importLibraryPanelsRecursively(c, service, signedInUser, libraryPanels, panelAsJSON.Get("panels").MustArray(), folderID, folderUID)
			if err != nil {
				return err
			}
			continue
		}

		// we have a library panel
		UID := libraryPanel.Get("uid").MustString()
		if len(UID) == 0 {
			return errLibraryPanelHeaderUIDMissing
		}

		_, err := service.GetElement(c, signedInUser, model.GetLibraryElementCommand{UID: UID, FolderName: dashboards.RootFolderName})
		if err == nil {
			continue
		}

		if errors.Is(err, model.ErrLibraryElementNotFound) {
			name := libraryPanel.Get("name").MustString()
			if len(name) == 0 {
				return errLibraryPanelHeaderNameMissing
			}

			elementModel := libraryPanels.Get(UID).Get("model")
			elementModel.Set("libraryPanel", map[string]any{
				"uid": UID,
			})

			Model, err := json.Marshal(&elementModel)
			if err != nil {
				return err
			}

			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryPanels).Inc()
			var cmd = model.CreateLibraryElementCommand{
				FolderID:  folderID, // nolint:staticcheck
				FolderUID: &folderUID,
				Name:      name,
				Model:     Model,
				Kind:      int64(model.PanelElement),
				UID:       UID,
			}
			_, err = service.CreateElement(c, signedInUser, cmd)
			if err != nil {
				return err
			}

			continue
		}

		return err
	}

	return nil
}

// CountInFolder is a handler for retrieving the number of library panels contained
// within a given folder and for a specific organisation.
func (lps LibraryPanelService) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) (int64, error) {
	if len(folderUIDs) == 0 {
		return 0, nil
	}

	var count int64
	return count, lps.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryPanels).Inc()
		s := fmt.Sprintf(`SELECT COUNT(*) FROM library_element WHERE org_id = ? AND folder_uid IN (%s) AND kind = ?`, strings.Repeat("?,", len(folderUIDs)-1)+"?")

		args := make([]interface{}, 0, len(folderUIDs)+2)
		args = append(args, orgID)
		for _, uid := range folderUIDs {
			args = append(args, uid)
		}
		args = append(args, int64(model.PanelElement))
		_, err := sess.SQL(s, args...).Get(&count)
		if err != nil {
			return err
		}
		return err
	})
}

// DeleteInFolder deletes the library panels contained in a given folder.
func (lps LibraryPanelService) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	for _, folderUID := range folderUIDs {
		if err := lps.LibraryElementService.DeleteLibraryElementsInFolder(ctx, user, folderUID); err != nil {
			return err
		}
	}
	return nil
}

// Kind returns the name of the library panel type of entity.
func (lps LibraryPanelService) Kind() string { return entity.StandardKindLibraryPanel }
