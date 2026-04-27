import type { DataFrame } from '@grafana/data/dataframe';
import { applyFieldOverrides } from '@grafana/data/field';
import type { GrafanaTheme2 } from '@grafana/data/themes';

export function prepDataForStorybook(data: DataFrame[], theme: GrafanaTheme2) {
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
