import { css } from '@emotion/css';
import { useId, useMemo } from 'react';

import { createFieldConfigRegistry, type SetFieldConfigOptionsArgs, type StandardEditorContext } from '@grafana/data';
import { type GraphFieldConfig, type TableSparklineCellOptions } from '@grafana/schema';
import { Field, useStyles2 } from '@grafana/ui';
import { defaultSparklineCellConfig } from '@grafana/ui/internal';

import { getGraphFieldConfig } from '../../timeseries/config';
import { type TableCellEditorProps } from '../TableCellOptionEditor';

type OptionKey = keyof TableSparklineCellOptions;

const optionIds: Array<keyof TableSparklineCellOptions> = [
  'hideValue',
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

function getChartCellConfig(cfg: GraphFieldConfig): SetFieldConfigOptionsArgs<GraphFieldConfig> {
  const graphFieldConfig = getGraphFieldConfig(cfg);
  return {
    ...graphFieldConfig,
    useCustomConfig: (builder) => {
      graphFieldConfig.useCustomConfig?.(builder);
      builder.addBooleanSwitch({
        path: 'hideValue',
        name: 'Hide value',
      });
    },
  };
}

export const SparklineCellOptionsEditor = (props: TableCellEditorProps<TableSparklineCellOptions>) => {
  const { cellOptions, onChange } = props;

  const registry = useMemo(() => {
    const config = getChartCellConfig(defaultSparklineCellConfig);
    return createFieldConfigRegistry(config, 'ChartCell');
  }, []);

  const style = useStyles2(getStyles);

  // This registry is built outside the options pane, so there are no panel options or field config to
  // put on the context - a showIf that reads one sees undefined and keeps the option hidden.
  const context = useMemo<StandardEditorContext<unknown>>(() => ({ data: [] }), []);

  const values = { ...defaultSparklineCellConfig, ...cellOptions };

  const htmlIdBase = useId();

  return (
    <>
      {registry.list(optionIds.map((id) => `custom.${id}`)).map((item) => {
        if (item.showIf && !item.showIf(values, context.data, context.annotations, context)) {
          return null;
        }
        const Editor = item.editor;
        const path = item.path;

        return (
          <Field key={item.id} noMargin label={item.name} className={style.field}>
            <Editor
              onChange={(val) => onChange({ ...cellOptions, [path]: val })}
              value={(isOptionKey(path, values) ? values[path] : undefined) ?? item.defaultValue}
              item={item}
              context={context}
              id={`${htmlIdBase}${item.id}`}
            />
          </Field>
        );
      })}
    </>
  );
};

// jumping through hoops to avoid using "any"
function isOptionKey(key: string, options: TableSparklineCellOptions): key is OptionKey {
  return key in options;
}

const getStyles = () => ({
  field: css({
    width: '100%',

    // @TODO don't show "scheme" option for custom gradient mode.
    // it needs thresholds to work, which are not supported
    // for area chart cell right now
    "[title='Use color scheme to define gradient']": {
      display: 'none',
    },
  }),
});
