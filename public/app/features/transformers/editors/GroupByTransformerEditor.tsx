import { css, cx } from '@emotion/css';
import React, { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import {
  GroupByFieldOptions,
  GroupByOperationID,
  GroupByTransformerOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';
import { Select, StatsPicker, stylesFactory } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

export const GroupByTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupByTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input);

  const onConfigChange = useCallback(
    (fieldName: string) => (config: GroupByFieldOptions) => {
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

export const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }: FieldProps) => {
  const styles = getStyling();

  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: value?.value ?? null,
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

export const groupByTransformRegistryItem: TransformerRegistryItem<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  editor: GroupByTransformerEditor,
  transformation: standardTransformers.groupByTransformer,
  name: standardTransformers.groupByTransformer.name,
  description: standardTransformers.groupByTransformer.description,
};
