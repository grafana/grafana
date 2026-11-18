import { DISABLE_GROUPING } from '../constants';

const DEFAULT_GROUP_BY_LABELS = ['grafana_folder', 'alertname'];

/** The labels every overridden group-by includes. A new array each time, so callers can't change what others see. */
export function getDefaultGroupByLabels(): string[] {
  return [...DEFAULT_GROUP_BY_LABELS];
}

/** The group-by to save after the user's selection changes. Picking `DISABLE_GROUPING` replaces everything else, and a
 * selection that is only `DISABLE_GROUPING` stays as it is. Otherwise the marker is dropped and the default labels stay
 * included. */
export function nextGroupBy(selected: string[], pickedOption?: string): string[] {
  const others = selected.filter((value) => value !== DISABLE_GROUPING);
  const onlyDisable = selected.length > 0 && others.length === 0;
  if (pickedOption === DISABLE_GROUPING || onlyDisable) {
    return [DISABLE_GROUPING];
  }
  return [...new Set([...DEFAULT_GROUP_BY_LABELS, ...others])];
}
