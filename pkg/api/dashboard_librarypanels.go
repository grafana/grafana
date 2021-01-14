package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func loadLibraryPanels(dash *models.Dashboard) error {
	query := models.GetLibraryPanelsQuery{DashboardId: dash.Id}

	if err := bus.Dispatch(&query); err != nil {
		return err
	}

	panels := dash.Data.Get("panels").MustArray()
	for i, panel := range panels {
		panelAsJson := simplejson.NewFromAny(panel)
		libraryPanel := panelAsJson.Get("libraryPanel")
		if libraryPanel.Interface() == nil {
			continue
		}

		// we have a library panel
		uid := libraryPanel.Get("uid").MustString()
		if len(uid) == 0 {
			return errors.New("found a library panel without uid")
		}

		libraryPanelInDb, ok := query.Result[uid]
		if !ok {
			return errors.New("found a library panel that does not exists as a connection")
		}

		// we have a match between what is stored in db and in dashboard json
		libraryPanelModel, err := libraryPanelInDb.Model.MarshalJSON()
		if err != nil {
			return errors.New("could not marshal library panel json")
		}

		libraryPanelModelAsJson, err := simplejson.NewJson(libraryPanelModel)
		if err != nil {
			return errors.New("could not convert library panel to json")
		}

		// set the library panel json as new panel json in dashboard json
		dash.Data.Get("panels").SetIndex(i, libraryPanelModelAsJson.Interface())

		// set dashboard specific props
		dash.Data.Get("panels").GetIndex(i).Set("gridPos", panelAsJson.Get("gridPos").MustMap())
		dash.Data.Get("panels").GetIndex(i).Set("id", panelAsJson.Get("id").MustInt64())
		dash.Data.Get("panels").GetIndex(i).Set("libraryPanel", make(map[string]interface{}))
		dash.Data.Get("panels").GetIndex(i).Get("libraryPanel").Set("uid", libraryPanelInDb.UID)
		dash.Data.Get("panels").GetIndex(i).Get("libraryPanel").Set("name", libraryPanelInDb.Name)
	}

	return nil
}
