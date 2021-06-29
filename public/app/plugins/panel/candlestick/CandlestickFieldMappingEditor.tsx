import React, { FC } from 'react';
import { StandardEditorProps, SelectableValue, GrafanaTheme } from '@grafana/data';
import { Select, stylesFactory, useTheme } from '@grafana/ui';

import { PanelOptions } from './models.gen';
import { CandlestickFieldMappings, candlestickFields } from './types';
import {
  useFieldDisplayNames,
  getSelectOptions,
} from '../../../../../packages/grafana-ui/src/components/MatchersUI/utils';
import { css } from '@emotion/css';

export const CandlestickFieldMappingsEditor: FC<StandardEditorProps<CandlestickFieldMappings, any, PanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const names = useFieldDisplayNames(context.data);
  if (!value) {
    value = {}; // avoid undefined checks
  }

  return (
    <div>
      {candlestickFields.map((k) => {
        const current = value[k];
        const selectOptions = getSelectOptions(names, current);
        const selectedOption = selectOptions.find((v) => v.value === current);
        return (
          <div key={k} className={styles.section}>
            <label className={styles.label}>{k}</label>
            <Select
              value={selectedOption}
              options={selectOptions}
              onChange={(selection: SelectableValue<string>) => {
                onChange({
                  ...value,
                  [k]: selection.value,
                });
              }}
            />
            <br />
          </div>
        );
      })}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  label: css`
    text-transform: capitalize;
  `,
  section: css`
    margin-bottom: 2px;
  `,
}));
