package librarypanels

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
	LoadLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error
	CleanLibraryPanelsForDashboard(dash *models.Dashboard) error
	ConnectLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error
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
func (lps *LibraryPanelService) LoadLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error {
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
		uid := libraryPanel.Get("uid").MustString()
		if len(uid) == 0 {
			return errLibraryPanelHeaderUIDMissing
		}

		elementInDB, ok := elements[uid]
		if !ok {
			name := libraryPanel.Get("name").MustString()
			elem := parent.Get("panels").GetIndex(i)
			elem.Set("gridPos", panelAsJSON.Get("gridPos").MustMap())
			elem.Set("id", panelAsJSON.Get("id").MustInt64())
			elem.Set("type", fmt.Sprintf("Name: \"%s\", UID: \"%s\"", name, uid))
			elem.Set("libraryPanel", map[string]interface{}{
				"uid":  uid,
				"name": name,
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
		elem.Set("gridPos", panelAsJSON.Get("gridPos").MustMap())
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
		uid := libraryPanel.Get("uid").MustString()
		if len(uid) == 0 {
			return errLibraryPanelHeaderUIDMissing
		}
		name := libraryPanel.Get("name").MustString()
		if len(name) == 0 {
			return errLibraryPanelHeaderNameMissing
		}

		// keep only the necessary JSON properties, the rest of the properties should be safely stored in library_panels table
		gridPos := panelAsJSON.Get("gridPos").MustMap()
		id := panelAsJSON.Get("id").MustInt64(int64(i))
		parent.Get("panels").SetIndex(i, map[string]interface{}{
			"id":      id,
			"gridPos": gridPos,
			"libraryPanel": map[string]interface{}{
				"uid":  uid,
				"name": name,
			},
		})
	}

	return nil
}

// ConnectLibraryPanelsForDashboard loops through all panels in dashboard JSON and connects any library panels to the dashboard.
func (lps *LibraryPanelService) ConnectLibraryPanelsForDashboard(c *models.ReqContext, dash *models.Dashboard) error {
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

	return lps.LibraryElementService.ConnectElementsToDashboard(c, elementUIDs, dash.Id)
}

func isLibraryPanelOrRow(panel *simplejson.Json, panelType string) bool {
	return panel.Interface() != nil || panelType == "row"
}

func connectLibraryPanelsRecursively(c *models.ReqContext, panels []interface{}, libraryPanels map[string]string) error {
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
		uid := libraryPanel.Get("uid").MustString()
		if len(uid) == 0 {
			return errLibraryPanelHeaderUIDMissing
		}
		_, exists := libraryPanels[uid]
		if !exists {
			libraryPanels[uid] = uid
		}
	}

	return nil
}
