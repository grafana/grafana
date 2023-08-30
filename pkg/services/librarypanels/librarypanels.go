package librarypanels

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
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
	ConnectLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, dash *dashboards.Dashboard) error
	ImportLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []any, folderID int64) error
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

// ConnectLibraryPanelsForDashboard loops through all panels in dashboard JSON and connects any library panels to the dashboard.
func (lps *LibraryPanelService) ConnectLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, dash *dashboards.Dashboard) error {
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
func (lps *LibraryPanelService) ImportLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []any, folderID int64) error {
	return importLibraryPanelsRecursively(c, lps.LibraryElementService, signedInUser, libraryPanels, panels, folderID)
}

func importLibraryPanelsRecursively(c context.Context, service libraryelements.Service, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []any, folderID int64) error {
	for _, panel := range panels {
		panelAsJSON := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJSON.Get("libraryPanel")
		panelType := panelAsJSON.Get("type").MustString()
		if !isLibraryPanelOrRow(libraryPanel, panelType) {
			continue
		}

		// we have a row
		if panelType == "row" {
			err := importLibraryPanelsRecursively(c, service, signedInUser, libraryPanels, panelAsJSON.Get("panels").MustArray(), folderID)
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

			var cmd = model.CreateLibraryElementCommand{
				FolderID: folderID,
				Name:     name,
				Model:    Model,
				Kind:     int64(model.PanelElement),
				UID:      UID,
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
func (lps LibraryPanelService) CountInFolder(ctx context.Context, orgID int64, folderUID string, u *user.SignedInUser) (int64, error) {
	var count int64
	return count, lps.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		folder, err := lps.FolderService.Get(ctx, &folder.GetFolderQuery{UID: &folderUID, OrgID: orgID, SignedInUser: u})
		if err != nil {
			return err
		}

		q := sess.Table("library_element").Where("org_id = ?", u.OrgID).
			Where("folder_id = ?", folder.ID).Where("kind = ?", int64(model.PanelElement))
		count, err = q.Count()
		return err
	})
}

// DeleteInFolder deletes the library panels contained in a given folder.
func (lps LibraryPanelService) DeleteInFolder(ctx context.Context, orgID int64, folderUID string, user *user.SignedInUser) error {
	return lps.LibraryElementService.DeleteLibraryElementsInFolder(ctx, user, folderUID)
}

// Kind returns the name of the library panel type of entity.
func (lps LibraryPanelService) Kind() string { return entity.StandardKindLibraryPanel }
