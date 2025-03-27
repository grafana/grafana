import { range } from 'lodash';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Select, Label } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorPropertyType,
  BuilderQueryEditorReduceExpression,
} from '../../dataquery.gen';

import { aggregateOptions, inputFieldSize } from './utils';

interface AggregateItemProps {
  aggregate: BuilderQueryEditorReduceExpression;
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
  const isPercentile = aggregate.reduce?.name === 'percentile';
  const isCountAggregate = aggregate.reduce?.name?.includes('count');

  const [percentileValue, setPercentileValue] = useState(aggregate.parameters?.[0]?.value || '');
  const [columnValue, setColumnValue] = useState(
    isPercentile ? aggregate.parameters?.[1]?.value || '' : aggregate.property?.name || ''
  );

  const safeTemplateVariables = Array.isArray(templateVariableOptions)
    ? templateVariableOptions
    : [templateVariableOptions];

  const selectableOptions = columns.concat(safeTemplateVariables);

  const buildPercentileParams = (percentile: string, column: string) => [
    {
      type: BuilderQueryEditorExpressionType.Function_parameter,
      fieldType: BuilderQueryEditorPropertyType.Number,
      value: percentile,
    },
    {
      type: BuilderQueryEditorExpressionType.Function_parameter,
      fieldType: BuilderQueryEditorPropertyType.String,
      value: column,
    },
  ];

  const updateAggregate = (updates: Partial<BuilderQueryEditorReduceExpression>) => {
    const base: BuilderQueryEditorReduceExpression = {
      ...aggregate,
      ...updates,
    };

    onChange(base);
  };

  const handleAggregateChange = (funcName?: string) => {
    updateAggregate({
      reduce: { name: funcName || '', type: BuilderQueryEditorPropertyType.Function },
    });
  };

  const handlePercentileChange = (value?: string) => {
    const newValue = value || '';
    setPercentileValue(newValue);

    const percentileParams = buildPercentileParams(newValue, columnValue);
    updateAggregate({ parameters: percentileParams });
  };

  const handleColumnChange = (value?: string) => {
    const newCol = value || '';
    setColumnValue(newCol);

    if (isPercentile) {
      const percentileParams = buildPercentileParams(percentileValue, newCol);
      updateAggregate({
        parameters: percentileParams,
        property: {
          name: newCol,
          type: BuilderQueryEditorPropertyType.String,
        },
      });
    } else {
      updateAggregate({
        property: {
          name: newCol,
          type: BuilderQueryEditorPropertyType.String,
        },
      });
    }
  };

  return (
    <InputGroup>
      <Select
        aria-label="aggregate function"
        width={inputFieldSize}
        value={aggregate.reduce?.name ? { label: aggregate.reduce.name, value: aggregate.reduce.name } : null}
        options={aggregateOptions}
        onChange={(e) => handleAggregateChange(e.value)}
      />

      {isPercentile ? (
        <>
          <Select
            aria-label="percentile value"
            options={range(0, 101, 5).map((n) => ({ label: n.toString(), value: n.toString() }))}
            value={percentileValue ? { label: percentileValue, value: percentileValue } : ''}
            width={inputFieldSize}
            onChange={(e) => handlePercentileChange(e.value)}
          />
          <Label style={{ margin: '9px 9px 0 9px' }}>OF</Label>
        </>
      ) : (
        <></>
      )}

      {!isCountAggregate ? (
        <Select
          aria-label="column"
          width={inputFieldSize}
          value={columnValue ? { label: columnValue, value: columnValue } : null}
          options={selectableOptions}
          onChange={(e) => handleColumnChange(e.value)}
        />
      ) : (
        <></>
      )}

      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

export default AggregateItem;
