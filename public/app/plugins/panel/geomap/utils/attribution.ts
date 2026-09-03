import type BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import Layer from 'ol/layer/Layer';
import type Source from 'ol/source/Source';

import { type MapLayerOptions, type MapLayerRegistryItem } from '@grafana/data';

import { geomapLayerRegistry } from '../layers/registry';
import { type ControlsOptions, type MapLayerState } from '../types';

/**
 * OpenLayers collects attribution from every visible source, so the only way to hide it is to take it
 * off the source. Keep the value that the layer was created with so it can be put back when
 * attribution is turned on again.
 */
const originalAttributions = new WeakMap<Source, ReturnType<Source['getAttributions']>>();

function forEachSource(layer: BaseLayer, apply: (source: Source) => void) {
  if (layer instanceof LayerGroup) {
    layer.getLayers().forEach((child) => forEachSource(child, apply));
    return;
  }
  if (layer instanceof Layer) {
    const source = layer.getSource();
    if (source) {
      apply(source);
    }
  }
}

/**
 * The source license requires attribution, so it can not be hidden
 */
function isAttributionRequired(item: MapLayerRegistryItem<unknown> | undefined, options: MapLayerOptions): boolean {
  const requires = item?.requiresAttribution;
  return typeof requires === 'function' ? requires(options) : requires === true;
}

/**
 * Record the attribution each source was created with. Must run before attribution is hidden so the
 * original value is never lost.
 */
export function captureLayerAttribution(layer: BaseLayer) {
  forEachSource(layer, (source) => {
    if (!originalAttributions.has(source)) {
      originalAttributions.set(source, source.getAttributions());
    }
  });
}

function setLayerAttributionVisible(layer: BaseLayer, visible: boolean) {
  forEachSource(layer, (source) => {
    if (!visible) {
      source.setAttributions(undefined);
      return;
    }
    // Sources that load asynchronously (MapLibre styles) get their attribution after it was captured,
    // so only restore a value that was actually recorded
    const original = originalAttributions.get(source);
    if (original) {
      source.setAttributions(original);
    }
  });
}

/**
 * Show attribution that the license requires, plus the attribution of the remaining layers when the
 * user has left the map control enabled.
 */
export function updateAttributionVisibility(layers: MapLayerState[], controls?: ControlsOptions) {
  const showOptional = controls?.showAttribution !== false;
  for (const state of layers) {
    const item = geomapLayerRegistry.getIfExists(state.options.type);
    setLayerAttributionVisible(state.layer, showOptional || isAttributionRequired(item, state.options));
  }
}
