import { applyFieldOverrides, DataFrame, GrafanaThemeV2 } from '@grafana/data';

export function prepDataForStorybook(data: DataFrame[], theme: GrafanaThemeV2) {
  return applyFieldOverrides({
    data: data,
    fieldConfig: {
      overrides: [],
      defaults: {},
    },
    theme,
    replaceVariables: (value: string) => value,
  });
}
