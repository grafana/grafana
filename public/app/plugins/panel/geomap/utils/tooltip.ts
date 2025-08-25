import { debounce } from 'lodash';
import { MapBrowserEvent } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { toLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';

import { DataFrame, DataHoverClearEvent } from '@grafana/data/src';

import { GeomapPanel } from '../GeomapPanel';
import { GeomapHoverPayload, GeomapLayerHover } from '../event';
import { MapLayerState } from '../types';

import { getMapLayerState } from './layers';

export const setTooltipListeners = (panel: GeomapPanel) => {
  // Tooltip listener
  panel.map?.on('singleclick', panel.pointerClickListener);
  panel.map?.on('pointermove', debounce(panel.pointerMoveListener, 200));
  panel.map?.getViewport().addEventListener('mouseout', (evt: MouseEvent) => {
    panel.props.eventBus.publish(new DataHoverClearEvent());
  });
};

export const pointerClickListener = (evt: MapBrowserEvent<MouseEvent>, panel: GeomapPanel) => {
  if (pointerMoveListener(evt, panel)) {
    evt.preventDefault();
    evt.stopPropagation();
    panel.mapDiv!.style.cursor = 'auto';
    panel.setState({ ttipOpen: true });
  }
};

export const pointerMoveListener = (evt: MapBrowserEvent<MouseEvent>, panel: GeomapPanel) => {
  // If measure menu is open, bypass tooltip logic and display measuring mouse events
  if (panel.state.measureMenuActive) {
    return true;
  }

  // Eject out of this function if map is not loaded or valid tooltip is already open
  if (!panel.map || (panel.state.ttipOpen && panel.state?.ttip?.layers?.length)) {
    return false;
  }

  const mouse = evt.originalEvent;
  const pixel = panel.map.getEventPixel(mouse);
  const hover = toLonLat(panel.map.getCoordinateFromPixel(pixel));

  const { hoverPayload } = panel;
  hoverPayload.pageX = mouse.pageX;
  hoverPayload.pageY = mouse.pageY - window.scrollY;
  hoverPayload.point = {
    lat: hover[1],
    lon: hover[0],
  };
  hoverPayload.data = undefined;
  hoverPayload.columnIndex = undefined;
  hoverPayload.rowIndex = undefined;
  hoverPayload.layers = undefined;

  const layers: GeomapLayerHover[] = [];
  const layerLookup = new Map<MapLayerState, GeomapLayerHover>();

  let ttip: GeomapHoverPayload = {} as GeomapHoverPayload;
  panel.map.forEachFeatureAtPixel(
    pixel,
    (feature, layer, geo) => {
      const s = getMapLayerState(layer);
      //match hover layer to layer in layers
      //check if the layer show tooltip is enabled
      //then also pass the list of tooltip fields if exists
      //this is used as the generic hover event
      if (!hoverPayload.data) {
        const props = feature.getProperties();
        const frame: DataFrame = props['frame'];
        if (frame) {
          hoverPayload.data = ttip.data = frame;
          hoverPayload.rowIndex = ttip.rowIndex = props['rowIndex'];
        }

        if (s?.mouseEvents) {
          s.mouseEvents.next(feature);
        }
      }

      if (s) {
        let h = layerLookup.get(s);
        if (!h) {
          h = { layer: s, features: [] };
          layerLookup.set(s, h);
          layers.push(h);
        }

        // Only add if not already present
        if (!h.features.some((f) => f === feature)) {
          h.features.push(feature);
        }

        // For WebGLPointsLayer, check for additional features at the same coordinates
        if (layer instanceof WebGLPointsLayer) {
          const featureGeom = feature.getGeometry();
          if (featureGeom instanceof Point) {
            const featureCoords = featureGeom.getCoordinates();
            const source = layer.getSource() as VectorSource;
            let addedFeatures = false;
            source.forEachFeature((otherFeature: FeatureLike) => {
              // Ignore duplicates
              if (otherFeature !== feature && !h.features.some((f) => f === otherFeature)) {
                const otherGeom = otherFeature.getGeometry();
                if (otherGeom instanceof Point) {
                  const otherCoords = otherGeom.getCoordinates();
                  // Check for matching coordinates
                  if (otherCoords[0] === featureCoords[0] && otherCoords[1] === featureCoords[1]) {
                    h.features.push(otherFeature);
                    addedFeatures = true;
                  }
                }
              }
            });
            // If we found multiple features at the same coordinates, sort them by rowIndex
            if (addedFeatures) {
              h.features.sort((a, b) => {
                const aIndex =
                  a.getProperties()['rowIndex'] !== undefined
                    ? Number(a.getProperties()['rowIndex'])
                    : Number.MAX_SAFE_INTEGER;
                const bIndex =
                  b.getProperties()['rowIndex'] !== undefined
                    ? Number(b.getProperties()['rowIndex'])
                    : Number.MAX_SAFE_INTEGER;
                return aIndex - bIndex;
              });
            }
          }
        }
      }
    },
    {
      layerFilter: (l) => {
        const hoverLayerState = getMapLayerState(l);
        return hoverLayerState?.options?.tooltip !== false;
      },
    }
  );
  panel.hoverPayload.layers = layers.length ? layers : undefined;
  panel.props.eventBus.publish(panel.hoverEvent);

  // This check optimizes Geomap panel re-render behavior (without it, Geomap renders on every mouse move event)
  if (panel.state.ttip === undefined || panel.state.ttip?.layers !== hoverPayload.layers || hoverPayload.layers) {
    panel.setState({ ttip: { ...hoverPayload } });
  }

  if (!layers.length) {
    // clear mouse events
    panel.layers.forEach((layer) => {
      layer.mouseEvents.next(undefined);
    });
  }

  const found = Boolean(layers.length);
  panel.mapDiv!.style.cursor = found ? 'pointer' : 'auto';
  return found;
};
