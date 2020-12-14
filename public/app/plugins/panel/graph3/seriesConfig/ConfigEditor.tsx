import React, { useCallback } from 'react';
import _ from 'lodash';
import { MultiSelect } from '@grafana/ui';
import { FieldConfigEditorProps, SelectableValue } from '@grafana/data';
import { HideSeriesConfig } from '@grafana/ui/src/components/uPlot/config';

interface SeriesConfigEditorContext {
  values: string[];
  options: Array<SelectableValue<string>>;
}

export const SeriesConfigEditor: React.FC<FieldConfigEditorProps<HideSeriesConfig, {}>> = props => {
  const { options, values } = Object.keys(props.value).reduce(
    (ctx: SeriesConfigEditorContext, value: keyof HideSeriesConfig) => {
      ctx.options.push({
        label: _.startCase(value),
        value,
      });

      if (props.value[value]) {
        ctx.values.push(value);
      }

      return ctx;
    },
    { values: [], options: [] }
  );

  const onChange = useCallback(
    (values: Array<SelectableValue<string>>) => {
      const next = Object.keys(props.value).reduce(
        (next, value: keyof HideSeriesConfig) => {
          next[value] = !!values.find(v => v.value === value);
          return next;
        },
        { ...props.value }
      );

      props.onChange(next);
    },
    [props.onChange, props.value]
  );

  return <MultiSelect isSearchable={false} options={options} value={values} onChange={onChange} />;
};
