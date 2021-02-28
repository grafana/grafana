import { applyFieldOverrides, DataFrame, GrafanaTheme } from '@grafana/data';

export function prepDataForStorybook(data: DataFrame[], theme: GrafanaTheme) {
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
