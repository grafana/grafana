import { type DataFrame, type DataTransformerConfig } from '@grafana/data';
import { type CustomTransformerDefinition, sceneGraph, type SceneDataTransformer } from '@grafana/scenes';
import { type PanelRuntimeTransformations } from '@grafana/ui';

const EMPTY_SERIES: readonly DataFrame[] = [];

function isConfig(entry: DataTransformerConfig | CustomTransformerDefinition): entry is DataTransformerConfig {
  return typeof entry === 'object' && 'id' in entry;
}

/** Lets panel controls edit the saved transformation list while the panel editor is open. */
export function createSavedPanelTransformations(
  transformer: SceneDataTransformer,
  getInitialSourceSeries?: (owner: string) => readonly DataFrame[] | undefined
): PanelRuntimeTransformations {
  let current = transformer.state.transformations;
  let configs = current.filter(isConfig);

  return {
    get: () => {
      if (current !== transformer.state.transformations) {
        current = transformer.state.transformations;
        configs = current.filter(isConfig);
      }
      return configs;
    },
    set: (_, transformations) => {
      const replacements = transformations[Symbol.iterator]();
      const next: Array<DataTransformerConfig | CustomTransformerDefinition> = [];
      for (const entry of transformer.state.transformations) {
        if (!isConfig(entry)) {
          next.push(entry);
          continue;
        }
        const replacement = replacements.next();
        if (!replacement.done) {
          next.push(replacement.value);
        }
      }
      for (const remaining of replacements) {
        next.push(remaining);
      }
      transformer.setState({ transformations: next });
      transformer.reprocessTransformations();
    },
    getSourceSeries: (owner) => {
      const initialSourceSeries = getInitialSourceSeries?.(owner);
      if (initialSourceSeries?.length) {
        return initialSourceSeries;
      }
      try {
        const source =
          transformer.state.$data ?? (transformer.parent?.parent && sceneGraph.getData(transformer.parent.parent));
        return source?.state.data?.series ?? EMPTY_SERIES;
      } catch {
        return EMPTY_SERIES;
      }
    },
    subscribe: (_, listener) => {
      const subscription = transformer.subscribeToState((next, previous) => {
        if (next.transformations !== previous.transformations) {
          listener();
        }
      });
      return () => subscription.unsubscribe();
    },
  };
}
