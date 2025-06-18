import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Select, Label, Input } from '@grafana/ui';

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
        aria-label={t('components.aggregate-item.aria-label-aggregate-function', 'Aggregate function')}
        width={inputFieldSize}
        value={aggregate.reduce?.name ? { label: aggregate.reduce.name, value: aggregate.reduce.name } : null}
        options={aggregateOptions}
        onChange={(e) => handleAggregateChange(e.value)}
      />

      {isPercentile ? (
        <>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={percentileValue ?? ''}
            width={inputFieldSize}
            onChange={(e) => {
              const val = Number(e.currentTarget.value);
              if (!isNaN(val) && val >= 0 && val <= 100) {
                handlePercentileChange(val.toString());
              }
            }}
          />
          <Label style={{ margin: '9px 9px 0 9px' }}>
            <Trans i18nKey="components.aggregate-item.label-percentile">OF</Trans>
          </Label>
        </>
      ) : (
        <></>
      )}

      {!isCountAggregate ? (
        <Select
          aria-label={t('components.aggregate-item.aria-label-column', 'Column')}
          width={inputFieldSize}
          value={columnValue ? { label: columnValue, value: columnValue } : null}
          options={selectableOptions}
          onChange={(e) => handleColumnChange(e.value)}
        />
      ) : (
        <></>
      )}

      <AccessoryButton
        aria-label={t('components.aggregate-item.aria-label-remove', 'Remove')}
        icon="times"
        variant="secondary"
        onClick={onDelete}
      />
    </InputGroup>
  );
};

export default AggregateItem;
