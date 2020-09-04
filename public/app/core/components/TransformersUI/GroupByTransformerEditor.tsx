import React, { useMemo, useCallback } from 'react';
import { css, cx } from 'emotion';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  ReducerID,
  SelectableValue,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, StatsPicker, stylesFactory } from '@grafana/ui';

import {
  GroupByTransformerOptions,
  GroupByOperationID,
  GroupByFieldOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

export const GroupByTransformerEditor: React.FC<TransformerUIProps<GroupByTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);

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
    [options]
  );

  return (
    <div>
      {fieldNames.map((key: string) => (
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

export const GroupByFieldConfiguration: React.FC<FieldProps> = ({ fieldName, config, onConfigChange }) => {
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
            menuPlacement="bottom"
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
            onChange={stats => {
              onConfigChange({ ...config, aggregations: stats as ReducerID[] });
            }}
            menuPlacement="bottom"
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

export const groupByTransformRegistryItem: TransformerRegistyItem<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  editor: GroupByTransformerEditor,
  transformation: standardTransformers.groupByTransformer,
  name: standardTransformers.groupByTransformer.name,
  description: standardTransformers.groupByTransformer.description,
};
