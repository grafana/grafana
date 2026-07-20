import { debounce } from 'lodash';
import { type FeatureLike } from 'ol/Feature';
import type MapBrowserEvent from 'ol/MapBrowserEvent';
import { Point } from 'ol/geom';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import { toLonLat } from 'ol/proj';

import { type DataFrame, DataHoverClearEvent } from '@grafana/data';

import { type GeomapPanel } from '../GeomapPanel';
import { type GeomapLayerHover } from '../event';
import {
  getMarkerClusterHitFeatures,
  getMarkerClusterMembers,
  getMarkerClusterZoomTarget,
  isMarkerClusterSourceLayer,
} from '../layers/data/markerCluster';
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
  if (zoomToClusterAtPixel(evt, panel)) {
    evt.preventDefault();
    evt.stopPropagation();
    return;
  }

  if (pointerMoveListener(evt, panel)) {
    evt.preventDefault();
    evt.stopPropagation();
    panel.mapDiv!.style.cursor = 'auto';
    panel.setState({ ttipOpen: true });
  }
};

const CLUSTER_ZOOM_PADDING_PX = 50;

// Zoom into a cluster's member extent on click. Returns false when there is no
// multi-member cluster at the pixel or when zooming cannot separate the members
// (co-located points, or a view already fitted to them). A false return lets the
// click fall through to the tooltip path, which lists the members instead.
const zoomToClusterAtPixel = (evt: MapBrowserEvent, panel: GeomapPanel): boolean => {
  const map = panel.map;
  // Never move the view while the measure tool is placing vertices, or while a
  // pinned tooltip is open: clicks are inert until it's explicitly closed
  // (matching the marker click path, which no-ops via the ttipOpen guard in
  // pointerMoveListener below). Without this, the view could zoom out from
  // under a pinned tooltip that's still showing stale content.
  if (!map || panel.state.measureMenuActive || panel.state.ttipOpen) {
    return false;
  }

  const members = map.forEachFeatureAtPixel(
    evt.pixel,
    (feature, layer) => {
      if (!isMarkerClusterSourceLayer(layer)) {
        return undefined;
      }
      const clusterMembers = getMarkerClusterMembers(feature);
      return clusterMembers && clusterMembers.length > 1 ? clusterMembers : undefined;
    },
    {
      // Layers with tooltip interactions disabled should not react to clicks either
      layerFilter: (l) => getMapLayerState(l)?.options?.tooltip !== false,
    }
  );
  if (!members) {
    return false;
  }

  const view = map.getView();
  const extent = getMarkerClusterZoomTarget(members, view, map.getSize(), CLUSTER_ZOOM_PADDING_PX, HIT_TOLERANCE_PX);
  if (!extent) {
    return false;
  }

  view.fit(extent, {
    padding: [CLUSTER_ZOOM_PADDING_PX, CLUSTER_ZOOM_PADDING_PX, CLUSTER_ZOOM_PADDING_PX, CLUSTER_ZOOM_PADDING_PX],
    duration: 300,
    maxZoom: view.getMaxZoom(),
  });
  return true;
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
  // Fast membership checks alongside each GeomapLayerHover.features array:
  // the co-located feature scan below can push many features, and a linear
  // some() per push made dense hovers quadratic.
  const layerFeatureSets = new Map<MapLayerState, Set<FeatureLike>>();

  // Compute the coordinate-space tolerance from the current map resolution.
  // Resolution is map units (meters in EPSG:3857) per pixel. Multiplying by
  // the pixel tolerance gives the per-axis threshold below which two features
  // are considered co-located. When resolution is unavailable (0), tolerance
  // falls back to 0 which preserves the legacy exact-match behavior.
  const view = panel.map.getView();
  const mapSize = panel.map.getSize();
  const resolution = view.getResolution() ?? 0;
  const tolerance = resolution * HIT_TOLERANCE_PX;

  let hoveredZoomableCluster = false;
  panel.map.forEachFeatureAtPixel(
    pixel,
    (feature, layer, geo) => {
      const s = getMapLayerState(layer);
      // Cluster features carry their members in a `features` property and have no
      // frame/rowIndex of their own. Singletons resolve to their member so they
      // tooltip like ordinary markers. For a multi-member cluster, a click that
      // can pull the members apart shows only a cursor hint (no tooltip); when
      // zooming cannot separate them (co-located points) the tooltip lists every
      // member so they stay reachable. Only layers backed by a cluster source are
      // treated this way: other layers can carry arbitrary user data properties,
      // including one named `features`.
      if (isMarkerClusterSourceLayer(layer)) {
        const members = getMarkerClusterMembers(feature);
        if (
          members &&
          members.length > 1 &&
          getMarkerClusterZoomTarget(members, view, mapSize, CLUSTER_ZOOM_PADDING_PX, HIT_TOLERANCE_PX)
        ) {
          hoveredZoomableCluster = true;
          return;
        }
      }
      const hitFeatures = isMarkerClusterSourceLayer(layer) ? getMarkerClusterHitFeatures(feature) : [feature];
      const primaryFeature = hitFeatures[0];
      //match hover layer to layer in layers
      //check if the layer show tooltip is enabled
      //then also pass the list of tooltip fields if exists
      //this is used as the generic hover event
      if (!hoverPayload.data) {
        const props = primaryFeature.getProperties();
        const frame: DataFrame = props['frame'];
        if (frame) {
          hoverPayload.data = frame;
          hoverPayload.rowIndex = props['rowIndex'];
        }

        if (s?.mouseEvents) {
          s.mouseEvents.next(primaryFeature);
        }
      }

      if (s) {
        let h = layerLookup.get(s);
        let hFeatures = layerFeatureSets.get(s);
        if (!h || !hFeatures) {
          h = { layer: s, features: [] };
          hFeatures = new Set();
          layerLookup.set(s, h);
          layerFeatureSets.set(s, hFeatures);
          layers.push(h);
        }

        // Only add if not already present
        for (const hitFeature of hitFeatures) {
          if (!hFeatures.has(hitFeature)) {
            hFeatures.add(hitFeature);
            h.features.push(hitFeature);
          }
        }

        // For WebGLPointsLayer, check for additional features at the same coordinates.
        // WebGL hit detection only returns the topmost feature at a pixel, so we
        // search the source for other features whose coordinates are within the
        // pixel tolerance of the hit feature. This catches both exactly co-located
        // features (identical coordinates) and nearly co-located features that
        // differ due to floating-point imprecision from geocoding or lookup mode.
        // Cluster sources group co-located points themselves, so they skip this.
        if (layer instanceof WebGLPointsLayer && !isMarkerClusterSourceLayer(layer)) {
          const featureGeom = feature.getGeometry();
          if (featureGeom instanceof Point) {
            const featureCoords = featureGeom.getCoordinates();
            const source = layer.getSource();
            let addedFeatures = false;
            source?.forEachFeature((otherFeature: FeatureLike) => {
              // Ignore duplicates
              if (otherFeature !== feature && !hFeatures.has(otherFeature)) {
                const otherGeom = otherFeature.getGeometry();
                if (otherGeom instanceof Point) {
                  const otherCoords = otherGeom.getCoordinates();
                  // Check for co-located coordinates within the per-axis pixel
                  // tolerance, matching the approach in isSegmentVisible
                  const dx = Math.abs(otherCoords[0] - featureCoords[0]);
                  const dy = Math.abs(otherCoords[1] - featureCoords[1]);
                  if (dx <= tolerance && dy <= tolerance) {
                    hFeatures.add(otherFeature);
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
  panel.mapDiv!.style.cursor = found || hoveredZoomableCluster ? 'pointer' : 'auto';
  return found;
};
