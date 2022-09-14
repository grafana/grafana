import { View, Collection } from 'ol';
import { Coordinate } from 'ol/coordinate';
import { isEmpty } from 'ol/extent';
import BaseLayer from 'ol/layer/Base';
import { fromLonLat } from 'ol/proj';

import { MapViewConfig } from '../types';
import { centerPointRegistry, MapCenterID } from '../view';

import { getLayersExtent } from './getLayersExtent';

export const initViewExtent = (view: View, config: MapViewConfig, layers: Collection<BaseLayer>) => {
  const v = centerPointRegistry.getIfExists(config.id);
  if (v) {
    let coord: Coordinate | undefined = undefined;
    if (v.lat == null) {
      if (v.id === MapCenterID.Coordinates) {
        coord = [config.lon ?? 0, config.lat ?? 0];
      } else if (v.id === MapCenterID.Fit) {
        const extent = getLayersExtent(layers);
        if (!isEmpty(extent)) {
          view.fit(extent, {
            padding: [30, 30, 30, 30],
            maxZoom: config.zoom ?? config.maxZoom,
          });
        }
      } else {
        // TODO: view requires special handling
      }
    } else {
      coord = [v.lon ?? 0, v.lat ?? 0];
    }
    if (coord) {
      view.setCenter(fromLonLat(coord));
    }
  }

  if (config.maxZoom) {
    view.setMaxZoom(config.maxZoom);
  }
  if (config.minZoom) {
    view.setMaxZoom(config.minZoom);
  }
  if (config.zoom && v?.id !== MapCenterID.Fit) {
    view.setZoom(config.zoom);
  }
};

export const initMapView = (
  config: MapViewConfig,
  sharedView?: View | undefined,
  layers?: Collection<BaseLayer>
): Array<View | undefined> => {
  let view = new View({
    center: [0, 0],
    zoom: 1,
    showFullExtent: true, // allows zooming so the full range is visible
  });

  // With shared views, all panels use the same view instance
  if (config.shared) {
    if (!sharedView) {
      sharedView = view;
    } else {
      view = sharedView;
    }
  }
  if (layers) {
    initViewExtent(view, config, layers);
  }

  return [sharedView, view];
};
