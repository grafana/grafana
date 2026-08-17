import { type CustomTransformOperator, type DataTransformerConfig } from '@grafana/data';
import { type SceneDataTransformer } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';

/** Stable identity so consumers that memoize on this — or use it as an effect dep — do not churn. */
const NONE: Array<DataTransformerConfig | CustomTransformOperator> = [];

/**
 * The transformations a panel's plugin requires, in the form `transformDataFrame` accepts.
 *
 * Needed by anything that reconstructs what a user transformation receives. They run ahead of every
 * user transformation but are deliberately kept out of `state.transformations` — the list editors and
 * serializers read — so replaying that list alone starts a stage late and shows a field shape the
 * transformation will never be given.
 *
 * Entries may be bare operators, configs, or operators scoped to a topic. Only series-topic ones
 * reach a user transformation's input, matching how the pipeline splits topics.
 */
export function getReplayableSystemTransformations(
  provider: SceneDataTransformer | null | undefined
): Array<DataTransformerConfig | CustomTransformOperator> {
  const entries = provider?.state.systemTransformations?.prepend;

  if (!entries?.length) {
    return NONE;
  }

  return entries.flatMap((entry) => {
    if (typeof entry === 'function' || !('operator' in entry)) {
      return entry;
    }

    return entry.topic === DataTopic.Series ? entry.operator : [];
  });
}
