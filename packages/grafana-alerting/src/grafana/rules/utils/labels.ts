export const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

export function isPrivateLabelKey(labelKey: string) {
  return (labelKey.startsWith('__') && labelKey.endsWith('__')) || labelKey === GRAFANA_ORIGIN_LABEL;
}

export const isPrivateLabel = ([key, _]: [string, string]) => isPrivateLabelKey(key);
