import { useCallback, useMemo, useState } from 'react';

import { usePluginContext } from '@grafana/data';
import { type DataTransformerConfig } from '@grafana/schema';

import { usePanelContext } from './PanelContext';

const EMPTY: DataTransformerConfig[] = [];

/** A transformation the panel itself created, as opposed to one authored in the editor. */
function isAdHoc(config: DataTransformerConfig): boolean {
  return config.origin?.source === 'panel';
}

/**
 * Where panel-created transformations sit relative to editor-authored ones. `before` entries run
 * ahead of the whole editor pipeline, `after` entries run last.
 *
 * @alpha -- experimental
 */
export interface AdHocTransformationPositions {
  before?: DataTransformerConfig[];
  after?: DataTransformerConfig[];
}

/**
 * @alpha -- experimental
 */
export interface AdHocTransformationsApi {
  /**
   * True when the host handed this panel its transformation pipeline, which means reads and writes
   * go to the dashboard: they persist, and they show up in the transformations editor.
   *
   * False in hosts that provide no pipeline (Explore, a bare `PanelRenderer`) and when the panel
   * plugin has not declared `adHocTransforms`. The pipeline still works in that case — it is just
   * held in component state, so it lasts only as long as the panel is mounted. Gate *UI* that
   * implies persistence (a "hide this column for good" menu item) on this flag; do not gate the
   * transformations themselves, which `useTransformedData` applies either way.
   */
  enabled: boolean;

  /** The whole pipeline in execution order, template variables already interpolated. */
  transformations: DataTransformerConfig[];

  /** Just the entries this panel created. */
  adHocTransformations: DataTransformerConfig[];

  /**
   * Appends a transformation, stamped as panel-created. Always appends — it never merges into an
   * existing entry of the same id, because transformation options have no merge contract and
   * rewriting an editor-authored entry would be surprising. Use `replaceAdHoc` to keep a single
   * entry in sync with panel state instead of appending on every interaction.
   */
  add: (config: DataTransformerConfig) => void;

  /**
   * Replaces every panel-created entry, keeping editor-authored entries in their existing order.
   *
   * Pass an array to put them all last, or `{ before, after }` to straddle the editor's entries —
   * which is what a panel needs when one of its transformations prepares the data the user then
   * transforms (extracting fields out of a JSON column) and another shapes the final output
   * (selecting and ordering columns).
   */
  replaceAdHoc: (configs: DataTransformerConfig[] | AdHocTransformationPositions) => void;

  /** Removes panel-created entries — all of them, or just those matching `predicate`. */
  clearAdHoc: (predicate?: (config: DataTransformerConfig) => boolean) => void;

  /** Replaces the whole pipeline verbatim, without stamping anything. */
  set: (configs: DataTransformerConfig[]) => void;
}

/**
 * Read and write the panel's transformation pipeline from inside a panel plugin, so the
 * visualization can offer its own transformation UI.
 *
 * A panel that declares `adHocTransforms: true` in its plugin.json receives untransformed data in
 * a dashboard and is responsible for applying the pipeline itself — see `useTransformedData`.
 *
 * @alpha -- experimental
 */
export function useAdHocTransformations(): AdHocTransformationsApi {
  const { isAdHocTransformsEnabled, getTransformations, setTransformations } = usePanelContext();
  const pluginContext = usePluginContext();
  const pluginId = pluginContext?.meta.id;

  const enabled = Boolean(isAdHocTransformsEnabled?.() && getTransformations && setTransformations);

  // Hosts other than the dashboard hand the panel no pipeline at all. Holding one in component
  // state there means a panel has a single code path everywhere instead of reimplementing its
  // transformations for the hosts that cannot persist them.
  const [localTransformations, setLocalTransformations] = useState<DataTransformerConfig[]>(EMPTY);

  const transformations = (enabled ? getTransformations?.() : localTransformations) || EMPTY;

  const adHocTransformations = useMemo(() => transformations.filter(isAdHoc), [transformations]);

  const set = useCallback(
    (configs: DataTransformerConfig[]) => {
      if (enabled) {
        setTransformations?.(configs);
      } else {
        setLocalTransformations(configs);
      }
    },
    [enabled, setTransformations]
  );

  const stamp = useCallback(
    (config: DataTransformerConfig): DataTransformerConfig => ({
      ...config,
      origin: { source: 'panel', ...(pluginId && { pluginId }), ...config.origin },
    }),
    [pluginId]
  );

  const add = useCallback(
    (config: DataTransformerConfig) => set([...transformations, stamp(config)]),
    [set, stamp, transformations]
  );

  const replaceAdHoc = useCallback(
    (configs: DataTransformerConfig[] | AdHocTransformationPositions) => {
      const positions = Array.isArray(configs) ? { after: configs } : configs;
      const before = positions.before ?? EMPTY;
      const after = positions.after ?? EMPTY;

      set([...before.map(stamp), ...transformations.filter((t) => !isAdHoc(t)), ...after.map(stamp)]);
    },
    [set, stamp, transformations]
  );

  const clearAdHoc = useCallback(
    (predicate?: (config: DataTransformerConfig) => boolean) =>
      set(transformations.filter((t) => !isAdHoc(t) || (predicate ? !predicate(t) : false))),
    [set, transformations]
  );

  return { enabled, transformations, adHocTransformations, add, replaceAdHoc, clearAdHoc, set };
}
