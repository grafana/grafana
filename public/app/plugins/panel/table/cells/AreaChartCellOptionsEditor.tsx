import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { createFieldConfigRegistry } from '@grafana/data';
import { GraphFieldConfig, TableAreaChartCellOptions } from '@grafana/schema';
import { VerticalGroup, Field, useStyles2, ColorPickerInput } from '@grafana/ui';
import { defaultAreaChartCellConfig } from '@grafana/ui/src/components/Table/AreaChartCell';

import { getGraphFieldConfig } from '../../timeseries/config';
import { TableCellEditorProps } from '../TableCellOptionEditor';

type OptionKey = keyof TableAreaChartCellOptions;

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

export const AreaChartCellOptionsEditor = (props: TableCellEditorProps<TableAreaChartCellOptions>) => {
  const { cellOptions, onChange } = props;

  const registry = useMemo(() => {
    const config = getGraphFieldConfig(defaultAreaChartCellConfig);
    return createFieldConfigRegistry(config, 'AreaChartCell');
  }, []);

  const style = useStyles2(getStyles);

  return (
    <VerticalGroup>
      {registry.list(optionIds.map((id) => `custom.${id}`)).map((item) => {
        if (item.showIf && !item.showIf({ ...defaultAreaChartCellConfig, ...cellOptions })) {
          return null;
        }
        const Editor = item.editor;

        const path = item.path;

        return (
          <Field label={item.name} key={item.id} className={style.field}>
            <Editor
              onChange={(val) => onChange({ ...cellOptions, [item.path]: val })}
              value={(isOptionKey(path, cellOptions) ? cellOptions[path] : undefined) ?? item.defaultValue}
              item={item}
              context={{ data: [] }}
            />
          </Field>
        );
      })}
      <Field label="Color">
        <ColorPickerInput value={cellOptions.color} onChange={(color) => onChange({ ...cellOptions, color })} />
      </Field>
    </VerticalGroup>
  );
};

// jumping through hoops to avoid using "any"
function isOptionKey(key: string, options: TableAreaChartCellOptions): key is OptionKey {
  return key in options;
}

const getStyles = () => ({
  field: css`
    width: 100%;

    // @TODO don't show "scheme" option for custom gradient mode.
    // it needs thresholds to work, which are not supported
    // for area chart cell right now
    [for='option-scheme-custom.gradientMode'] {
      display: none;
    }
  `,
});
