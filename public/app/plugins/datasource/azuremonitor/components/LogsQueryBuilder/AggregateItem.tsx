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

import { aggregateOptions } from './utils';

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

  const safeTemplateVariables = Array.isArray(templateVariableOptions)
    ? templateVariableOptions
    : [templateVariableOptions];

  const selectableOptions = columns.concat(safeTemplateVariables);

  // ✅ Extracted: Handle function change
  const handleFunctionChange = (funcName?: string) => {
    onChange({
      ...aggregate,
      reduce: {
        name: funcName || '',
        type: BuilderQueryEditorPropertyType.Function,
      },
      property: {
        name: aggregate.property?.name || '',
        type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
      },
    });
  };

  // ✅ Extracted: Handle percentile update
  const handlePercentileChange = (value?: string) => {
    setPercentileValue(value || '');
    onChange({
      ...aggregate,
      reduce: { name: 'percentile', type: BuilderQueryEditorPropertyType.Function },
      property: {
        name: columnValue || '',
        type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
      },
      parameters: [
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.Number,
          value: value || '',
        },
        {
          type: BuilderQueryEditorExpressionType.Function_parameter,
          fieldType: BuilderQueryEditorPropertyType.String,
          value: columnValue || '',
        },
      ],
    });
  };

  // ✅ Extracted: Handle column change
  const handleColumnChange = (value?: string) => {
    setColumnValue(value || '');
    if (isPercentile) {
      onChange({
        ...aggregate,
        reduce: { name: 'percentile', type: BuilderQueryEditorPropertyType.Function },
        property: {
          name: value || '',
          type: BuilderQueryEditorPropertyType.String,
        },
        parameters: [
          {
            type: BuilderQueryEditorExpressionType.Function_parameter,
            fieldType: BuilderQueryEditorPropertyType.Number,
            value: percentileValue || '',
          },
          {
            type: BuilderQueryEditorExpressionType.Function_parameter,
            fieldType: BuilderQueryEditorPropertyType.String,
            value: value || '',
          },
        ],
      });
    } else {
      onChange({
        ...aggregate,
        property: {
          name: value || '',
          type: BuilderQueryEditorPropertyType.String,
        },
        reduce: aggregate.reduce || { name: '', type: BuilderQueryEditorPropertyType.String },
      });
    }
  };

  return (
    <InputGroup>
      <Select
        aria-label="aggregate function"
        width="auto"
        value={aggregate.reduce?.name ? { label: aggregate.reduce?.name, value: aggregate.reduce?.name } : null}
        options={aggregateOptions}
        onChange={(e) => handleFunctionChange(e.value)}
      />

      {isPercentile ? (
        <>
          <Select
            aria-label="percentile value"
            options={range(0, 101, 5).map((n) => ({ label: n.toString(), value: n.toString() }))}
            value={percentileValue ? { label: percentileValue, value: percentileValue } : ''}
            width="auto"
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
          width="auto"
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
