import type BaseLayer from 'ol/layer/Base';
import LayerGroup from 'ol/layer/Group';
import Layer from 'ol/layer/Layer';
import type Source from 'ol/source/Source';
import type { Attribution, AttributionLike } from 'ol/source/Source';

import { type MapLayerOptions, type MapLayerRegistryItem, textUtil } from '@grafana/data';

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

/** Wrappers this module produced, so a value that is set, hidden and restored is only wrapped once. */
const sanitizedAttributions = new WeakSet<Attribution>();
const guardedSources = new WeakSet<Source>();
const observedLayers = new WeakSet<BaseLayer>();

function sanitizeAttributions(attributions: AttributionLike | undefined): AttributionLike | undefined {
  if (!attributions) {
    return undefined;
  }
  if (typeof attributions === 'function' && sanitizedAttributions.has(attributions)) {
    return attributions;
  }
  const resolve: Attribution = typeof attributions === 'function' ? attributions : () => attributions;
  const sanitized: Attribution = (viewState) => {
    const value = resolve(viewState);
    const entries = Array.isArray(value) ? value : [value];
    // Attribution is a credit line — a link, a small logo, some text. The text panel sanitizer keeps
    // more than that (a sandboxed iframe, for one), so use the stricter one and drop an entry that
    // came back empty rather than render a blank bullet for it
    return entries.map((entry) => textUtil.sanitize(entry)).filter((entry) => entry.trim() !== '');
  };
  sanitizedAttributions.add(sanitized);
  return sanitized;
}

/**
 * OpenLayers puts attribution into the DOM as HTML, so anything a source carries has to be filtered
 * first. Filtering it on the source, rather than where each layer reads its configuration, is what
 * covers attribution the layer never saw: a remote style document can name attribution for sources it
 * creates, and those sources can go on to take attribution from further documents they point at.
 */
function guardSource(source: Source) {
  if (guardedSources.has(source)) {
    return;
  }
  guardedSources.add(source);
  const setAttributions = source.setAttributions.bind(source);
  source.setAttributions = (attributions) => setAttributions(sanitizeAttributions(attributions));
  // Setting attribution marks the source as changed, and a layer can be waiting on that event to
  // read the data it just loaded, so only touch a source that actually carries something to filter
  const current = source.getAttributions();
  if (current) {
    source.setAttributions(current);
  }
}

/**
 * Filter the attribution of every source under this layer, both the sources it has now and the ones
 * it gains later — a layer that loads a remote style builds its sources after init returns.
 */
export function guardLayerAttribution(layer: BaseLayer) {
  if (layer instanceof LayerGroup) {
    const layers = layer.getLayers();
    layers.forEach((child) => guardLayerAttribution(child));
    if (!observedLayers.has(layer)) {
      observedLayers.add(layer);
      layers.on('add', (event) => guardLayerAttribution(event.element));
    }
    return;
  }
  if (layer instanceof Layer) {
    const source = layer.getSource();
    if (source) {
      guardSource(source);
    }
    if (!observedLayers.has(layer)) {
      observedLayers.add(layer);
      layer.on('change:source', () => {
        const next = layer.getSource();
        if (next) {
          guardSource(next);
        }
      });
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
