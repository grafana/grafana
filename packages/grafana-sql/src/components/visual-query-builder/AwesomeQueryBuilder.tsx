import {
  AnyObject,
  BasicConfig,
  Config,
  JsonTree,
  Operator,
  Settings,
  SimpleField,
  SqlFormatOperator,
  Utils,
  ValueSource,
  Widgets,
} from '@react-awesome-query-builder/ui';
import { List } from 'immutable';
import { isString } from 'lodash';
import React from 'react';

import { dateTime, toOption } from '@grafana/data';
import { Button, DateTimePicker, Input, Select } from '@grafana/ui';

const buttonLabels = {
  add: 'Add',
  remove: 'Remove',
};

export const emptyInitTree: JsonTree = {
  id: Utils.uuid(),
  type: 'group',
};

const TIME_FILTER = 'timeFilter';
const macros = [TIME_FILTER];

// Widgets are the components rendered for each field type see the docs for more info
// https://github.com/ukrbublik/react-awesome-query-builder/blob/master/CONFIG.adoc#configwidgets
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
      if (props?.operator === Op.MACROS) {
        return (
          <Select
            id={props.id}
            aria-label="Macros value selector"
            menuShouldPortal
            options={macros.map(toOption)}
            value={props?.value}
            onChange={(val) => props.setValue(val.value)}
          />
        );
      }
      const dateValue = dateTime(props?.value).isValid() ? dateTime(props?.value).utc() : undefined;
      return (
        <DateTimePicker
          onChange={(e) => {
            props?.setValue(e.format(BasicConfig.widgets.datetime.valueFormat));
          }}
          date={dateValue}
        />
      );
    },
    // Function for formatting widget’s value in SQL WHERE query.
    sqlFormatValue: (val, field, widget, operator, operatorDefinition, rightFieldDef) => {
      if (operator === Op.MACROS) {
        if (macros.includes(val)) {
          return val;
        }
        return undefined;
      }

      // This is just satisfying the type checker, this should never happen
      if (
        typeof BasicConfig.widgets.datetime.sqlFormatValue === 'string' ||
        typeof BasicConfig.widgets.datetime.sqlFormatValue === 'object'
      ) {
        return undefined;
      }
      const func = BasicConfig.widgets.datetime.sqlFormatValue;
      // We need to pass the ctx to this function this way so *this* is correct
      return func?.call(BasicConfig.ctx, val, field, widget, operator, operatorDefinition, rightFieldDef) || '';
    },
  },
};

// Settings are the configuration options for the query builder see the docs for more info
// https://github.com/ukrbublik/react-awesome-query-builder/blob/master/CONFIG.adoc#configsettings
export const settings: Settings = {
  ...BasicConfig.settings,
  canRegroup: false,
  maxNesting: 1,
  canReorder: false,
  showNot: false,
  addRuleLabel: buttonLabels.add,
  deleteLabel: buttonLabels.remove,
  // This is the component that renders conjunctions (logical operators)
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
  // This is the component that renders fields
  renderField: function Field(fieldProps) {
    const fields = fieldProps?.config?.fields || {};
    return (
      <Select
        id={fieldProps?.id}
        width={25}
        aria-label="Field"
        menuShouldPortal
        options={fieldProps?.items.map((f) => {
          // @ts-ignore
          const icon = fields[f.key].mainWidgetProps?.customProps?.icon;
          return {
            label: f.label,
            value: f.key,
            icon,
          };
        })}
        value={fieldProps?.selectedKey}
        onChange={(val) => {
          fieldProps?.setField(val.label!);
        }}
      />
    );
  },
  // This is the component used for the Add/Remove buttons
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
  // This is the component used for the fields operator selector
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
const enum Op {
  IN = 'select_any_in',
  NOT_IN = 'select_not_any_in',
  MACROS = 'macros',
}
const customOperators = getCustomOperators(BasicConfig);
const textWidget = BasicConfig.types.text.widgets.text;
const opers = [...(textWidget.operators || []), Op.IN, Op.NOT_IN];
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
  datetime: {
    ...BasicConfig.types.datetime,
    widgets: {
      ...BasicConfig.types.datetime.widgets,
      datetime: {
        ...BasicConfig.types.datetime.widgets.datetime,
        operators: [Op.MACROS, ...(BasicConfig.types.datetime.widgets.datetime.operators || [])],
      },
    },
  },
};

// This is the configuration for the query builder that doesn't include the fields but all the other configuration for the UI
// Fields should be added dynamically based on returned data
// See the doc for more info https://github.com/ukrbublik/react-awesome-query-builder/blob/master/CONFIG.adoc
export const raqbConfig: Config = {
  ...BasicConfig,
  widgets,
  settings,
  operators: customOperators,
  types: customTypes,
};

export type { Config };

const noop = () => '';

const isSqlFormatOp = (func: unknown): func is SqlFormatOperator => {
  return typeof func === 'function';
};

function getCustomOperators(config: BasicConfig) {
  const { ...supportedOperators } = config.operators;

  // IN operator expects array, override IN formatter for multi-value variables
  const sqlFormatInOpOrNoop = () => {
    const sqlFormatOp = supportedOperators[Op.IN].sqlFormatOp;
    if (isSqlFormatOp(sqlFormatOp)) {
      return sqlFormatOp;
    }
    return noop;
  };

  const customSqlInFormatter = (
    field: string,
    op: string,
    value: string | List<string>,
    valueSrc: ValueSource,
    valueType: string,
    opDef: Operator,
    operatorOptions: AnyObject,
    fieldDef: SimpleField
  ) => {
    return sqlFormatInOpOrNoop()(
      field,
      op,
      splitIfString(value),
      valueSrc,
      valueType,
      opDef,
      operatorOptions,
      fieldDef
    );
  };
  // NOT IN operator expects array, override NOT IN formatter for multi-value variables
  const sqlFormatNotInOpOrNoop = () => {
    const sqlFormatOp = supportedOperators[Op.NOT_IN].sqlFormatOp;
    if (isSqlFormatOp(sqlFormatOp)) {
      return sqlFormatOp;
    }
    return noop;
  };

  const customSqlNotInFormatter = (
    field: string,
    op: string,
    value: string | List<string>,
    valueSrc: ValueSource,
    valueType: string,
    opDef: Operator,
    operatorOptions: AnyObject,
    fieldDef: SimpleField
  ) => {
    return sqlFormatNotInOpOrNoop()(
      field,
      op,
      splitIfString(value),
      valueSrc,
      valueType,
      opDef,
      operatorOptions,
      fieldDef
    );
  };

  const customOperators = {
    ...supportedOperators,
    [Op.IN]: {
      ...supportedOperators[Op.IN],
      sqlFormatOp: customSqlInFormatter,
    },
    [Op.NOT_IN]: {
      ...supportedOperators[Op.NOT_IN],
      sqlFormatOp: customSqlNotInFormatter,
    },
    [Op.MACROS]: {
      label: 'Macros',
      sqlFormatOp: (field: string, _operator: string, value: string | List<string>) => {
        if (value === TIME_FILTER) {
          return `$__timeFilter(${field})`;
        }
        return value;
      },
    },
  };

  return customOperators;
}

// value: string | List<string> but AQB uses a different version of Immutable
function splitIfString(value: any) {
  if (isString(value)) {
    return value.split(',');
  }
  return value;
}
