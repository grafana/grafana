import {
  BaseOperator,
  BasicConfig,
  Config,
  Field,
  ImmutableList,
  JsonTree,
  Operator,
  OperatorOptionsI,
  Settings,
  Utils,
  ValueSource,
  WidgetProps,
  Widgets,
} from '@react-awesome-query-builder/ui';
import { isString } from 'lodash';

import { dateTime, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
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
    factory: function TextInput(props: WidgetProps) {
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
    factory: function NumberInput(props: WidgetProps) {
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
    factory: function DateTimeInput(props: WidgetProps) {
      if (props?.operator === Op.MACROS) {
        return (
          <Select
            id={props.id}
            aria-label={t('grafana-sql.components.widgets.aria-label-macros-value-selector', 'Macros value selector')}
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
            props?.setValue(e?.format(BasicConfig.widgets.datetime.valueFormat));
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
        aria-label={t('grafana-sql.components.settings.aria-label-conjunction', 'Conjunction')}
        data-testid={selectors.components.SQLQueryEditor.filterConjunction}
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
        aria-label={t('grafana-sql.components.settings.aria-label-field', 'Field')}
        data-testid={selectors.components.SQLQueryEditor.filterField}
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
        aria-label={t('grafana-sql.components.settings.title-button-filter', '{{ buttonLabel }} filter', {
          buttonLabel: buttonProps?.label,
        })}
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
        aria-label={t('grafana-sql.components.settings.aria-label-operator', 'Operator')}
        data-testid={selectors.components.SQLQueryEditor.filterOperator}
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

function getCustomOperators(config: BasicConfig) {
  const { ...supportedOperators } = config.operators;

  // IN operator expects array, override IN formatter for multi-value variables
  const sqlFormatInOp = supportedOperators[Op.IN].sqlFormatOp?.bind(config.ctx) || noop;
  const formatInOp = supportedOperators[Op.IN].formatOp?.bind(config.ctx) || noop;
  const customSqlInFormatter = (
    field: string,
    op: string,
    value: string | string[] | ImmutableList<string>,
    valueSrc: ValueSource | undefined,
    valueType: string | undefined,
    opDef: Operator | undefined,
    operatorOptions: OperatorOptionsI | undefined,
    fieldDef: Field | undefined
  ) => {
    return sqlFormatInOp(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
  };

  // NOT IN operator expects array, override NOT IN formatter for multi-value variables
  const sqlFormatNotInOp = supportedOperators[Op.NOT_IN].sqlFormatOp?.bind(config.ctx) || noop;
  const formatNotInOp = supportedOperators[Op.NOT_IN].formatOp?.bind(config.ctx) || noop;
  const customSqlNotInFormatter = (
    field: string,
    op: string,
    value: string | string[] | ImmutableList<string>,
    valueSrc: ValueSource | undefined,
    valueType: string | undefined,
    opDef: Operator | undefined,
    operatorOptions: OperatorOptionsI | undefined,
    fieldDef: Field | undefined
  ) => {
    return sqlFormatNotInOp(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
  };

  const customOperators: Record<string, BaseOperator> = {
    ...supportedOperators,
    [Op.IN]: {
      ...supportedOperators[Op.IN],
      formatOp: (
        field: string,
        op: string,
        value: string | string[] | ImmutableList<string>,
        valueSrc?: ValueSource
      ) => {
        return formatInOp(field, op, splitIfString(value), valueSrc);
      },
      sqlFormatOp: customSqlInFormatter,
    },
    [Op.NOT_IN]: {
      ...supportedOperators[Op.NOT_IN],
      formatOp: (
        field: string,
        op: string,
        value: string | string[] | ImmutableList<string>,
        valueSrc?: ValueSource
      ) => {
        return formatNotInOp(field, op, splitIfString(value), valueSrc);
      },
      sqlFormatOp: customSqlNotInFormatter,
    },
    [Op.MACROS]: {
      label: t('grafana-sql.components.get-custom-operators.custom-operators.label.macros', 'Macros'),
      sqlFormatOp: (field: string, _operator: string, value: string | string[] | ImmutableList<string>) => {
        if (value === TIME_FILTER) {
          return `$__timeFilter(${field})`;
        }
        throw new Error('Invalid macro');
      },
    },
  };

  return customOperators;
}

// value: string | List<string> but AQB uses a different version of Immutable
function splitIfString(value: string | string[] | ImmutableList<string>) {
  if (isString(value)) {
    return value.split(',');
  }
  return value;
}
