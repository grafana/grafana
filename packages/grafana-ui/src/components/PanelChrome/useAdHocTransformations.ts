import { useCallback, useMemo } from 'react';

import { usePluginContext } from '@grafana/data';
import { type DataTransformerConfig } from '@grafana/schema';

import { usePanelContext } from './PanelContext';

const EMPTY: DataTransformerConfig[] = [];

/** A transformation the panel itself created, as opposed to one authored in the editor. */
function isAdHoc(config: DataTransformerConfig): boolean {
  return config.origin?.source === 'panel';
}

/**
 * @alpha -- experimental
 */
export interface AdHocTransformationsApi {
  /**
   * False when the host does not support ad-hoc transformations, or the panel plugin has not
   * declared `adHocTransforms` in its plugin.json. All mutators are no-ops when false.
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
   * Replaces every panel-created entry with `configs`, keeping editor-authored entries in their
   * existing order first. Panel-created transformations therefore always run last.
   */
  replaceAdHoc: (configs: DataTransformerConfig[]) => void;

  /** Removes panel-created entries — all of them, or just those matching `predicate`. */
  clearAdHoc: (predicate?: (config: DataTransformerConfig) => boolean) => void;

  /** Replaces the whole pipeline verbatim, without stamping anything. */
  set: (configs: DataTransformerConfig[]) => void;
}

/**
 * Read and write the panel's transformation pipeline from inside a panel plugin, so the
 * visualization can offer its own transformation UI.
 *
 * Only meaningful for panels that declare `adHocTransforms: true` in their plugin.json. Such a
 * panel receives untransformed data and is responsible for applying the pipeline itself — see
 * `useTransformedData`.
 *
 * @alpha -- experimental
 */
export function useAdHocTransformations(): AdHocTransformationsApi {
  const { isAdHocTransformsEnabled, getTransformations, setTransformations } = usePanelContext();
  const pluginContext = usePluginContext();
  const pluginId = pluginContext?.meta.id;

  const enabled = Boolean(isAdHocTransformsEnabled?.() && getTransformations && setTransformations);
  const transformations = (enabled && getTransformations?.()) || EMPTY;

  const adHocTransformations = useMemo(() => transformations.filter(isAdHoc), [transformations]);

  const set = useCallback(
    (configs: DataTransformerConfig[]) => {
      if (enabled) {
        setTransformations?.(configs);
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
    (configs: DataTransformerConfig[]) => set([...transformations.filter((t) => !isAdHoc(t)), ...configs.map(stamp)]),
    [set, stamp, transformations]
  );

  const clearAdHoc = useCallback(
    (predicate?: (config: DataTransformerConfig) => boolean) =>
      set(transformations.filter((t) => !isAdHoc(t) || (predicate ? !predicate(t) : false))),
    [set, transformations]
  );

  return { enabled, transformations, adHocTransformations, add, replaceAdHoc, clearAdHoc, set };
}
