import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { createFieldConfigRegistry } from '@grafana/data';
import { GraphFieldConfig, TableChartCellOptions } from '@grafana/schema';
import { VerticalGroup, Field, useStyles2 } from '@grafana/ui';
import { defaultChartCellConfig } from '@grafana/ui/src/components/Table/ChartCell';

import { getGraphFieldConfig } from '../../timeseries/config';
import { TableCellEditorProps } from '../TableCellOptionEditor';

type OptionKey = keyof TableChartCellOptions;

const optionIds: Array<keyof GraphFieldConfig> = [
  'drawStyle',
  'lineInterpolation',
  'barAlignment',
  'lineWidth',
  'fillOpacity',
  'gradientMode',
  'lineStyle',
  'spanNulls',
  'showPoints',
  'pointSize',
];

export const ChartCellOptionsEditor = (props: TableCellEditorProps<TableChartCellOptions>) => {
  const { cellOptions, onChange } = props;

  const registry = useMemo(() => {
    const config = getGraphFieldConfig(defaultChartCellConfig);
    return createFieldConfigRegistry(config, 'ChartCell');
  }, []);

  const style = useStyles2(getStyles);

  const values = { ...defaultChartCellConfig, ...cellOptions };

  return (
    <VerticalGroup>
      {registry.list(optionIds.map((id) => `custom.${id}`)).map((item) => {
        if (item.showIf && !item.showIf(values)) {
          return null;
        }
        const Editor = item.editor;

        const path = item.path;

        return (
          <Field label={item.name} key={item.id} className={style.field}>
            <Editor
              onChange={(val) => onChange({ ...cellOptions, [path]: val })}
              value={(isOptionKey(path, values) ? values[path] : undefined) ?? item.defaultValue}
              item={item}
              context={{ data: [] }}
            />
          </Field>
        );
      })}
    </VerticalGroup>
  );
};

// jumping through hoops to avoid using "any"
function isOptionKey(key: string, options: TableChartCellOptions): key is OptionKey {
  return key in options;
}

const getStyles = () => ({
  field: css`
    width: 100%;

    // @TODO don't show "scheme" option for custom gradient mode.
    // it needs thresholds to work, which are not supported
    // for area chart cell right now
    [title='Use color scheme to define gradient'] {
      display: none;
    }
  `,
});
