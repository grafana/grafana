import { css, cx } from '@emotion/css';
import React, { useCallback } from 'react';

import {
  DataTransformerID,
  PluginState,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import {
  GroupByTimeBucket,
  GroupByTimeFieldOptions,
  GroupByOperationID,
  GroupByTimeTransformerOptions,
} from '@grafana/data/src/transformations/transformers/groupByTime';
import { Select, StatsPicker, stylesFactory } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByTimeFieldOptions;
  onConfigChange: (config: GroupByTimeFieldOptions) => void;
}

export const GroupByTimeTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupByTimeTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input);

  const onConfigChange = useCallback(
    (fieldName: string) => (config: GroupByTimeFieldOptions) => {
      onChange({
        ...options,
        fields: {
          ...options.fields,
          [fieldName]: config,
        },
      });
    },
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  return (
    <div>
      {fieldNames.map((key) => (
        <GroupByFieldConfiguration
          onConfigChange={onConfigChange(key)}
          fieldName={key}
          config={options.fields[key]}
          key={key}
        />
      ))}
    </div>
  );
};

const options = [
  { label: 'Group by', value: GroupByOperationID.groupBy },
  { label: 'Calculate', value: GroupByOperationID.aggregate },
];

const timeFrameOptions = [
  { label: 'Day', value: GroupByTimeBucket.day },
  { label: 'Month', value: GroupByTimeBucket.month },
  { label: 'Year', value: GroupByTimeBucket.year },
];

export const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }: FieldProps) => {
  const styles = getStyling();

  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: value?.value ?? null,
        timeBucket: config?.timeBucket ?? null,
      });
    },
    [config, onConfigChange]
  );

  const onTimeBucketChange = useCallback(
    (value: SelectableValue<GroupByTimeBucket | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: config?.operation ?? null,
        timeBucket: value?.value ?? null,
      });
    },
    [config, onConfigChange]
  );

  return (
    <div className={cx('gf-form-inline', styles.row)}>
      <div className={cx('gf-form', styles.fieldName)}>
        <div className={cx('gf-form-label', styles.rowSpacing)}>{fieldName}</div>
      </div>

      <div className={cx('gf-form', styles.cell)}>
        <div className={cx('gf-form-spacing', styles.rowSpacing)}>
          <Select
            className="width-12"
            options={options}
            value={config?.operation}
            placeholder="Ignored"
            onChange={onChange}
            isClearable
          />
        </div>
      </div>

      {config?.operation === GroupByOperationID.groupBy && (
        <div className={cx('gf-form', 'gf-form--grow', styles.calculations)}>
          <Select
            className={cx('flex-grow-1', styles.rowSpacing)}
            placeholder="Select Timeframe"
            options={timeFrameOptions}
            onChange={onTimeBucketChange}
            value={config?.timeBucket}
            isClearable
          />
        </div>
      )}

      {config?.operation === GroupByOperationID.aggregate && (
        <div className={cx('gf-form', 'gf-form--grow', styles.calculations)}>
          <StatsPicker
            className={cx('flex-grow-1', styles.rowSpacing)}
            placeholder="Select Stats"
            allowMultiple
            stats={config.aggregations}
            onChange={(stats) => {
              onConfigChange({ ...config, aggregations: stats as ReducerID[] });
            }}
          />
        </div>
      )}
    </div>
  );
};

const getStyling = stylesFactory(() => {
  const cell = css`
    display: table-cell;
  `;

  return {
    row: css`
      display: table-row;
    `,
    cell: cell,
    rowSpacing: css`
      margin-bottom: 4px;
    `,
    fieldName: css`
      ${cell}
      min-width: 250px;
      white-space: nowrap;
    `,
    calculations: css`
      ${cell}
      width: 99%;
    `,
  };
});

export const groupByTimeTransformRegistryItem: TransformerRegistryItem<GroupByTimeTransformerOptions> = {
  id: DataTransformerID.groupByTime,
  editor: GroupByTimeTransformerEditor,
  transformation: standardTransformers.groupByTimeTransformer,
  name: standardTransformers.groupByTimeTransformer.name,
  description: standardTransformers.groupByTimeTransformer.description,
  state: PluginState.alpha,
};
