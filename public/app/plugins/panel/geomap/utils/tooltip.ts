import { debounce } from 'lodash';
import { type FeatureLike } from 'ol/Feature';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { toLonLat } from 'ol/proj';
import type VectorSource from 'ol/source/Vector';

import { type DataFrame, DataHoverClearEvent } from '@grafana/data';

import { type GeomapPanel } from '../GeomapPanel';
import { type GeomapHoverPayload, type GeomapLayerHover } from '../event';
import { type MapLayerState } from '../types';

import { getMapLayerState } from './layers';

// Number of pixels of tolerance when matching co-located features.
// This accounts for floating-point imprecision in projected coordinates
// from geocoding or lookup-mode location resolution. A small value (2px)
// catches float drift without merging visually distinct points.
const HIT_TOLERANCE_PX = 2;

export const setTooltipListeners = (panel: GeomapPanel) => {
  panel.tooltipPointerMoveDebounced?.cancel();

  const debouncedMove = debounce((evt: MapBrowserEvent) => pointerMoveListener(evt, panel), 200);
  panel.tooltipPointerMoveDebounced = debouncedMove;

  panel.map?.on('singleclick', (evt) => pointerClickListener(evt, panel));
  panel.map?.on('pointermove', debouncedMove);
  panel.map?.getViewport().addEventListener('pointerleave', () => {
    debouncedMove.cancel();
    panel.props.eventBus.publish(new DataHoverClearEvent());
    panel.clearTooltip();
  });
};

export const pointerClickListener = (evt: MapBrowserEvent, panel: GeomapPanel) => {
  if (pointerMoveListener(evt, panel)) {
    evt.preventDefault();
    evt.stopPropagation();
    panel.mapDiv!.style.cursor = 'auto';
    panel.setState({ ttipOpen: true });
  }
};

export const pointerMoveListener = (evt: MapBrowserEvent, panel: GeomapPanel) => {
  // If measure menu is open, bypass tooltip logic and display measuring mouse events
  if (panel.state.measureMenuActive) {
    return true;
  }

  // Eject out of this function if map is not loaded or valid tooltip is already open
  if (!panel.map || (panel.state.ttipOpen && panel.state?.ttip?.layers?.length)) {
    return false;
  }

  if (!(evt.originalEvent instanceof MouseEvent)) {
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

  // Compute the coordinate-space tolerance from the current map resolution.
  // Resolution is map units (meters in EPSG:3857) per pixel. Multiplying by
  // the pixel tolerance gives the distance threshold below which two features
  // are considered co-located. When resolution is unavailable (0), tolerance
  // falls back to 0 which preserves the legacy exact-match behavior.
  const resolution = panel.map.getView().getResolution() ?? 0;
  const tolerance = resolution * HIT_TOLERANCE_PX;
  const toleranceSq = tolerance * tolerance;

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

        // For WebGLPointsLayer, check for additional features at the same coordinates.
        // WebGL hit detection only returns the topmost feature at a pixel, so we
        // search the source for other features whose coordinates are within the
        // pixel tolerance of the hit feature. This catches both exactly co-located
        // features (identical coordinates) and nearly co-located features that
        // differ due to floating-point imprecision from geocoding or lookup mode.
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
                  // Check for co-located coordinates within pixel tolerance
                  // using Euclidean distance for circular proximity
                  const dx = otherCoords[0] - featureCoords[0];
                  const dy = otherCoords[1] - featureCoords[1];
                  if (dx * dx + dy * dy <= toleranceSq) {
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
