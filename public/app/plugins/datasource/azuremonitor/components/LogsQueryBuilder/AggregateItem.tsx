import { range } from 'lodash';
import React, { useState, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Select, Label } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
} from '../../dataquery.gen';

interface AggregateItemProps {
  aggregate: Partial<BuilderQueryEditorReduceExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorReduceExpression) => void;
  onDelete: () => void;
  templateVariableOptions: SelectableValue<string>;
}

const AggregateItem: React.FC<AggregateItemProps> = ({
  aggregate,
  onChange,
  onDelete,
  columns,
  templateVariableOptions,
}) => {
  const [isPercentile, setIsPercentile] = useState(aggregate.reduce?.name.includes('percentile'));
  const [isCountAggregate, setIsCountAggregate] = useState(aggregate.reduce?.name.includes('count'));

  const [percentileValue, setPercentileValue] = useState(aggregate.parameters?.[0]?.value || '');
  const [columnValue, setColumnValue] = useState(aggregate.property?.name || '');

  useEffect(() => {
    setIsPercentile(aggregate.reduce?.name.includes('percentile'));
    setIsCountAggregate(aggregate.reduce?.name.includes('count'));
  }, [aggregate.reduce?.name]);

  const safeTemplateVariables: Array<SelectableValue<string>> =
    templateVariableOptions && templateVariableOptions.value
      ? Array.isArray(templateVariableOptions)
        ? templateVariableOptions
        : [templateVariableOptions]
      : [];

  const selectableOptions = columns.concat(safeTemplateVariables);

  const updateAggregate = (percentile?: string, column?: string) => {
    onChange({
      ...aggregate,
      reduce: {
        name: 'percentile',
        type: BuilderQueryEditorPropertyType.Function,
      },
      property: {
        name: column || columnValue || '',
        type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
      },
      parameters: [
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.Number,
          value: percentile || percentileValue || '',
        },
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.String,
          value: column || columnValue || '',
        },
      ],
    });
  };

  return (
    <InputGroup>
      <Select
        aria-label="aggregate function"
        width="auto"
        value={aggregate.reduce?.name ? { label: aggregate.reduce?.name, value: aggregate.reduce?.name } : null}
        options={[
          { label: 'sum', value: 'sum' },
          { label: 'avg', value: 'avg' },
          { label: 'percentile', value: 'percentile' },
          { label: 'count', value: 'count' },
          { label: 'min', value: 'min' },
          { label: 'max', value: 'max' },
          { label: 'dcount', value: 'dcount' },
          { label: 'stdev', value: 'stdev' },
        ]}
        onChange={(e) => {
          const newAggregate = e.value;
          onChange({
            ...aggregate,
            reduce: {
              name: newAggregate || '',
              type: BuilderQueryEditorPropertyType.Function,
            },
            property: {
              name: aggregate.property?.name || '',
              type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
            },
          });
        }}
      />

      {isPercentile ? (
        <>
          <Select
            aria-label="percentile value"
            options={range(0, 101, 5).map((n) => ({ label: n.toString(), value: n.toString() }))}
            value={percentileValue ? { label: percentileValue, value: percentileValue } : ''}
            width="auto"
            onChange={(e) => {
              setPercentileValue(e.value || '');
              updateAggregate(e.value);
            }}
          />
          <Label style={{ margin: '9px 9px 0 9px' }}>OF</Label>
        </>
      ) : (
        <></>
      )}

      {!isCountAggregate ? (
        <Select
          aria-label="column"
          width="auto"
          value={columnValue ? { label: columnValue, value: columnValue } : null}
          options={selectableOptions}
          onChange={(e) => {
            setColumnValue(e.value || '');
            if (isPercentile) {
              updateAggregate(undefined, e.value);
            } else {
              onChange({
                ...aggregate,
                property: {
                  name: e.value || '',
                  type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
                },
                reduce: aggregate.reduce || { name: '', type: BuilderQueryEditorPropertyType.String },
              });
            }
          }}
        />
      ) : (
        <></>
      )}

      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

export default AggregateItem;
