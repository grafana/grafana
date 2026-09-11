import { rangeUtil } from '@grafana/data';

import { defaultSpec, type Spec as NotebookSpec } from './types';

/**
 * `defaultSpec()`, with its relative window resolved to the moment the notebook is being made — the
 * other half of the picker's pinning, so a notebook nobody touched does not go on sliding either.
 *
 * convertRawToRange rather than two dateMath.parse calls: it already rounds the two ends opposite ways.
 */
export function newNotebookSpec(): NotebookSpec {
  const spec = defaultSpec();
  const range = rangeUtil.convertRawToRange({ from: spec.timeSettings.from, to: spec.timeSettings.to });

  return {
    ...spec,
    timeSettings: {
      ...spec.timeSettings,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
  };
}
