import { isString } from 'lodash';
import React from 'react';
import { BasicConfig, Config, JsonItem, Settings, Utils, ValueSource, Widgets } from 'react-awesome-query-builder';

import { dateTime, toOption } from '@grafana/data';
import { Button, DateTimePicker, Input, Select } from '@grafana/ui';

const buttonLabels = {
  add: 'Add',
  remove: 'Remove',
};

export const emptyInitValue = {
  id: Utils.uuid(),
  type: 'group' as const,
  children1: {
    [Utils.uuid()]: {
      type: 'rule',
      properties: {
        field: null,
        operator: null,
        value: [],
        valueSrc: [],
      },
    } as JsonItem,
  },
};

export const widgets: Widgets = {
  ...BasicConfig.widgets,
  text: {
    ...BasicConfig.widgets.text,
    factory: function TextInput(props) {
      return (
        <Input
          value={props?.value || ''}
          placeholder={props?.placeholder}
          onChange={(e) => props?.setValue(e.currentTarget.value)}
        />
      );
    },
  },
  number: {
    ...BasicConfig.widgets.number,
    factory: function NumberInput(props) {
      return (
        <Input
          value={props?.value}
          placeholder={props?.placeholder}
          type="number"
          onChange={(e) => props?.setValue(Number.parseInt(e.currentTarget.value, 10))}
        />
      );
    },
  },
  datetime: {
    ...BasicConfig.widgets.datetime,
    factory: function DateTimeInput(props) {
      return (
        <DateTimePicker
          onChange={(e) => {
            props?.setValue(e.format(BasicConfig.widgets.datetime.valueFormat));
          }}
          date={dateTime(props?.value).utc()}
        />
      );
    },
  },
};

export const settings: Settings = {
  ...BasicConfig.settings,
  canRegroup: false,
  maxNesting: 1,
  canReorder: false,
  showNot: false,
  addRuleLabel: buttonLabels.add,
  deleteLabel: buttonLabels.remove,
  renderConjs: function Conjunctions(conjProps) {
    return (
      <Select
        id={conjProps?.id}
        aria-label="Conjunction"
        menuShouldPortal
        options={conjProps?.conjunctionOptions ? Object.keys(conjProps?.conjunctionOptions).map(toOption) : undefined}
        value={conjProps?.selectedConjunction}
        onChange={(val) => conjProps?.setConjunction(val.value!)}
      />
    );
  },
  renderField: function Field(fieldProps) {
    return (
      <Select
        id={fieldProps?.id}
        width={25}
        aria-label="Field"
        menuShouldPortal
        options={fieldProps?.items.map((f) => ({
          label: f.label,
          value: f.key,
          icon: (fieldProps.config?.fields[f.key] as any)?.mainWidgetProps?.customProps?.icon,
        }))}
        value={fieldProps?.selectedKey}
        onChange={(val) => {
          fieldProps?.setField(val.label!);
        }}
      />
    );
  },
  renderButton: function RAQBButton(buttonProps) {
    return (
      <Button
        type="button"
        title={`${buttonProps?.label} filter`}
        onClick={buttonProps?.onClick}
        variant="secondary"
        size="md"
        icon={buttonProps?.label === buttonLabels.add ? 'plus' : 'times'}
      />
    );
  },
  renderOperator: function Operator(operatorProps) {
    return (
      <Select
        options={operatorProps?.items.map((op) => ({ label: op.label, value: op.key }))}
        aria-label="Operator"
        menuShouldPortal
        value={operatorProps?.selectedKey}
        onChange={(val) => {
          operatorProps?.setField(val.value || '');
        }}
      />
    );
  },
};

// add IN / NOT IN operators to text to support multi-value variables
const customOperators = getCustomOperators(BasicConfig);
const textWidget = BasicConfig.types.text.widgets.text;
const opers = [...(textWidget.operators || []), 'select_any_in', 'select_not_any_in'];
const customTextWidget = {
  ...textWidget,
  operators: opers,
};

const customTypes = {
  ...BasicConfig.types,
  text: {
    ...BasicConfig.types.text,
    widgets: {
      ...BasicConfig.types.text.widgets,
      text: customTextWidget,
    },
  },
};

export const raqbConfig: Config = {
  ...BasicConfig,
  widgets,
  settings,
  operators: customOperators as typeof BasicConfig.operators,
  types: customTypes,
};

export type { Config };

function getCustomOperators(config: BasicConfig) {
  const { ...supportedOperators } = config.operators;
  const noop = () => '';
  // IN operator expects array, override IN formatter for multi-value variables
  const sqlFormatInOp = supportedOperators.select_any_in.sqlFormatOp || noop;
  const customSqlInFormatter = (
    field: string,
    op: string,
    value: any,
    valueSrc: ValueSource,
    valueType: string,
    opDef: any,
    operatorOptions: any,
    fieldDef: any
  ) => {
    return sqlFormatInOp(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
  };
  // NOT IN operator expects array, override NOT IN formatter for multi-value variables
  const sqlFormatNotInOp = supportedOperators.select_not_any_in.sqlFormatOp || noop;
  const customSqlNotInFormatter = (
    field: string,
    op: string,
    value: any,
    valueSrc: ValueSource,
    valueType: string,
    opDef: any,
    operatorOptions: any,
    fieldDef: any
  ) => {
    return sqlFormatNotInOp(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
  };

  const customOperators = {
    ...supportedOperators,
    select_any_in: {
      ...supportedOperators.select_any_in,
      sqlFormatOp: customSqlInFormatter,
    },
    select_not_any_in: {
      ...supportedOperators.select_not_any_in,
      sqlFormatOp: customSqlNotInFormatter,
    },
  };
  return customOperators;
}

function splitIfString(value: any) {
  if (isString(value)) {
    return value.split(',');
  }
  return value;
}
