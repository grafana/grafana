package librarypanels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister,
	libraryElementService libraryelements.Service) *LibraryPanelService {
	return &LibraryPanelService{
		Cfg:                   cfg,
		SQLStore:              sqlStore,
		RouteRegister:         routeRegister,
		LibraryElementService: libraryElementService,
		log:                   log.New("library-panels"),
	}
}

// Service is a service for operating on library panels.
type Service interface {
	LoadLibraryPanelsForDashboard(c context.Context, dash *models.Dashboard) error
	CleanLibraryPanelsForDashboard(dash *models.Dashboard) error
	ConnectLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, dash *models.Dashboard) error
	ImportLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []interface{}, folderID int64) error
}

type LibraryInfo struct {
	Panels        []*interface{}
	LibraryPanels *simplejson.Json
}

// LibraryPanelService is the service for the Panel Library feature.
type LibraryPanelService struct {
	Cfg                   *setting.Cfg
	SQLStore              *sqlstore.SQLStore
	RouteRegister         routing.RouteRegister
	LibraryElementService libraryelements.Service
	log                   log.Logger
}

// LoadLibraryPanelsForDashboard loops through all panels in dashboard JSON and replaces any library panel JSON
// with JSON stored for library panel in db.
func (lps *LibraryPanelService) LoadLibraryPanelsForDashboard(c context.Context, dash *models.Dashboard) error {
	elements, err := lps.LibraryElementService.GetElementsForDashboard(c, dash.Id)
	if err != nil {
		return err
	}

	return loadLibraryPanelsRecursively(elements, dash.Data)
}

func loadLibraryPanelsRecursively(elements map[string]libraryelements.LibraryElementDTO, parent *simplejson.Json) error {
	panels := parent.Get("panels").MustArray()
	for i, panel := range panels {
		panelAsJSON := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJSON.Get("libraryPanel")
		panelType := panelAsJSON.Get("type").MustString()
		if !isLibraryPanelOrRow(libraryPanel, panelType) {
			continue
		}

		// we have a row
		if panelType == "row" {
			err := loadLibraryPanelsRecursively(elements, panelAsJSON)
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

		elementInDB, ok := elements[UID]
		if !ok {
			elem := parent.Get("panels").GetIndex(i)
			gridPos := panelAsJSON.Get("gridPos").MustMap()
			if gridPos == nil {
				elem.Del("gridPos")
			} else {
				elem.Set("gridPos", gridPos)
			}
			elem.Set("id", panelAsJSON.Get("id").MustInt64())
			elem.Set("libraryPanel", map[string]interface{}{
				"uid": UID,
			})
			continue
		}

		if models.LibraryElementKind(elementInDB.Kind) != models.PanelElement {
			continue
		}

		// we have a match between what is stored in db and in dashboard json
		libraryPanelModel, err := elementInDB.Model.MarshalJSON()
		if err != nil {
			return fmt.Errorf("could not marshal library panel JSON: %w", err)
		}

		libraryPanelModelAsJSON, err := simplejson.NewJson(libraryPanelModel)
		if err != nil {
			return fmt.Errorf("could not convert library panel to simplejson model: %w", err)
		}

		// set the library panel json as the new panel json in dashboard json
		parent.Get("panels").SetIndex(i, libraryPanelModelAsJSON.Interface())

		// set dashboard specific props
		elem := parent.Get("panels").GetIndex(i)
		gridPos := panelAsJSON.Get("gridPos").MustMap()
		if gridPos == nil {
			elem.Del("gridPos")
		} else {
			elem.Set("gridPos", gridPos)
		}
		elem.Set("id", panelAsJSON.Get("id").MustInt64())
		elem.Set("libraryPanel", map[string]interface{}{
			"uid":         elementInDB.UID,
			"name":        elementInDB.Name,
			"type":        elementInDB.Type,
			"description": elementInDB.Description,
			"version":     elementInDB.Version,
			"meta": map[string]interface{}{
				"folderName":          elementInDB.Meta.FolderName,
				"folderUid":           elementInDB.Meta.FolderUID,
				"connectedDashboards": elementInDB.Meta.ConnectedDashboards,
				"created":             elementInDB.Meta.Created,
				"updated":             elementInDB.Meta.Updated,
				"createdBy": map[string]interface{}{
					"id":        elementInDB.Meta.CreatedBy.ID,
					"name":      elementInDB.Meta.CreatedBy.Name,
					"avatarUrl": elementInDB.Meta.CreatedBy.AvatarURL,
				},
				"updatedBy": map[string]interface{}{
					"id":        elementInDB.Meta.UpdatedBy.ID,
					"name":      elementInDB.Meta.UpdatedBy.Name,
					"avatarUrl": elementInDB.Meta.UpdatedBy.AvatarURL,
				},
			},
		})
	}

	return nil
}

// CleanLibraryPanelsForDashboard loops through all panels in dashboard JSON and cleans up any library panel JSON so that
// only the necessary JSON properties remain when storing the dashboard JSON.
func (lps *LibraryPanelService) CleanLibraryPanelsForDashboard(dash *models.Dashboard) error {
	return cleanLibraryPanelsRecursively(dash.Data)
}

func cleanLibraryPanelsRecursively(parent *simplejson.Json) error {
	panels := parent.Get("panels").MustArray()
	for i, panel := range panels {
		panelAsJSON := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJSON.Get("libraryPanel")
		panelType := panelAsJSON.Get("type").MustString()
		if !isLibraryPanelOrRow(libraryPanel, panelType) {
			continue
		}

		// we have a row
		if panelType == "row" {
			err := cleanLibraryPanelsRecursively(panelAsJSON)
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

		// keep only the necessary JSON properties, the rest of the properties should be safely stored in library_panels table
		gridPos := panelAsJSON.Get("gridPos").MustMap()
		ID := panelAsJSON.Get("id").MustInt64(int64(i))
		parent.Get("panels").SetIndex(i, map[string]interface{}{
			"id":      ID,
			"gridPos": gridPos,
			"libraryPanel": map[string]interface{}{
				"uid": UID,
			},
		})
	}

	return nil
}

// ConnectLibraryPanelsForDashboard loops through all panels in dashboard JSON and connects any library panels to the dashboard.
func (lps *LibraryPanelService) ConnectLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, dash *models.Dashboard) error {
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

	return lps.LibraryElementService.ConnectElementsToDashboard(c, signedInUser, elementUIDs, dash.Id)
}

func isLibraryPanelOrRow(panel *simplejson.Json, panelType string) bool {
	return panel.Interface() != nil || panelType == "row"
}

func connectLibraryPanelsRecursively(c context.Context, panels []interface{}, libraryPanels map[string]string) error {
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
func (lps *LibraryPanelService) ImportLibraryPanelsForDashboard(c context.Context, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []interface{}, folderID int64) error {
	return importLibraryPanelsRecursively(c, lps.LibraryElementService, signedInUser, libraryPanels, panels, folderID)
}

func importLibraryPanelsRecursively(c context.Context, service libraryelements.Service, signedInUser *user.SignedInUser, libraryPanels *simplejson.Json, panels []interface{}, folderID int64) error {
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

		_, err := service.GetElement(c, signedInUser, UID)
		if err == nil {
			continue
		}

		if errors.Is(err, libraryelements.ErrLibraryElementNotFound) {
			name := libraryPanel.Get("name").MustString()
			if len(name) == 0 {
				return errLibraryPanelHeaderNameMissing
			}

			elementModel := libraryPanels.Get(UID).Get("model")
			elementModel.Set("libraryPanel", map[string]interface{}{
				"uid": UID,
			})

			Model, err := json.Marshal(&elementModel)
			if err != nil {
				return err
			}

			var cmd = libraryelements.CreateLibraryElementCommand{
				FolderID: folderID,
				Name:     name,
				Model:    Model,
				Kind:     int64(models.PanelElement),
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
