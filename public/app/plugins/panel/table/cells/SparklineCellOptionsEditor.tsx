import { css } from '@emotion/css';
import { useId, useMemo } from 'react';

import { createFieldConfigRegistry, type SetFieldConfigOptionsArgs, type StandardEditorContext } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type GraphFieldConfig, type TableSparklineCellOptions } from '@grafana/schema';
import { Field, Label, useStyles2 } from '@grafana/ui';
import { defaultSparklineCellConfig } from '@grafana/ui/internal';
import { highlightOptionSearchTerm } from 'app/features/dashboard/components/PanelEditor/OptionSearchHighlight';

import { getGraphFieldConfig } from '../../timeseries/config';

import { type TableCellOptionEditorProps } from './TableCellOptionEditorRegistry';

type OptionKey = keyof TableSparklineCellOptions;

const optionIds: Array<keyof TableSparklineCellOptions> = [
  'hideValue',
  'showTooltip',
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

let sparklineCellOptionsRegistry: ReturnType<typeof createFieldConfigRegistry> | undefined;

function getSparklineCellOptionsRegistry() {
  if (!sparklineCellOptionsRegistry) {
    const config = getChartCellConfig(defaultSparklineCellConfig);
    sparklineCellOptionsRegistry = createFieldConfigRegistry(config, 'ChartCell');
  }

  return sparklineCellOptionsRegistry;
}

export function getSparklineCellOptionSearchTerms(cellOptions?: TableSparklineCellOptions): string[] {
  const values = { ...defaultSparklineCellConfig, ...cellOptions };
  const context: StandardEditorContext<unknown> = { data: [] };

  return getSparklineCellOptionsRegistry()
    .list(optionIds.map((id) => `custom.${id}`))
    .filter((item) => !item.showIf || item.showIf(values, context.data, context.annotations, context))
    .map((item) => item.name);
}

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
      builder.addBooleanSwitch({
        path: 'showTooltip',
        name: t('table.name-sparkline-show-tooltip', 'Show hover tooltip'),
        defaultValue: false,
        showIf: () => getFeatureFlagClient().getBooleanValue(FlagKeys.TableRefreshNewFeatures, false),
      });
    },
  };
}

export const SparklineCellOptionsEditor = (props: TableCellOptionEditorProps<TableSparklineCellOptions>) => {
  const { cellOptions, onChange, searchQuery } = props;

  const registry = useMemo(() => {
    return getSparklineCellOptionsRegistry();
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
          <Field
            key={item.id}
            noMargin
            label={
              <Label htmlFor={`${htmlIdBase}${item.id}`} description={item.description}>
                {searchQuery ? highlightOptionSearchTerm(item.name, searchQuery) : item.name}
              </Label>
            }
            htmlFor={`${htmlIdBase}${item.id}`}
            className={style.field}
          >
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
