import React, { useContext } from 'react';
import { Select, GrafanaTheme, ThemeContext, SelectOptionItem } from '@grafana/ui';
import { css, cx } from 'emotion';

const getStyles = (theme: GrafanaTheme) => ({
  keyValueContainer: css`
    label: key-value-container;
    display: flex;
    flex-flow: row nowrap;
  `,
});

enum ChangeType {
  Key = 'key',
  Value = 'value',
  Operator = 'operator',
}

export interface Props {
  keys: string[];
  keysPlaceHolder?: string;
  initialKey?: string;
  initialOperator?: string;
  initialValue?: string;
  values?: string[];
  valuesPlaceHolder?: string;
  onKeyChanged: (key: string) => void;
  onValueChanged: (value: string) => void;
  onOperatorChanged: (operator: string) => void;
}

export const AdHocFilter: React.FunctionComponent<Props> = props => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  const onChange = (changeType: ChangeType) => (item: SelectOptionItem<string>) => {
    const { onKeyChanged, onValueChanged, onOperatorChanged } = props;
    switch (changeType) {
      case ChangeType.Key:
        onKeyChanged(item.value);
        break;
      case ChangeType.Operator:
        onOperatorChanged(item.value);
        break;
      case ChangeType.Value:
        onValueChanged(item.value);
        break;
    }
  };

  const stringToOption = (value: string) => ({ label: value, value: value });

  const { keys, initialKey, keysPlaceHolder, initialOperator, values, initialValue, valuesPlaceHolder } = props;
  const operators = ['=', '!='];
  const keysAsOptions = keys ? keys.map(stringToOption) : [];
  const selectedKey = initialKey ? keysAsOptions.filter(option => option.value === initialKey) : null;
  const valuesAsOptions = values ? values.map(stringToOption) : [];
  const selectedValue = initialValue ? valuesAsOptions.filter(option => option.value === initialValue) : null;
  const operatorsAsOptions = operators.map(stringToOption);
  const selectedOperator = initialOperator
    ? operatorsAsOptions.filter(option => option.value === initialOperator)
    : null;

  return (
    <div className={cx([styles.keyValueContainer])}>
      <Select
        options={keysAsOptions}
        isSearchable
        value={selectedKey}
        onChange={onChange(ChangeType.Key)}
        placeholder={keysPlaceHolder}
      />
      <Select options={operatorsAsOptions} value={selectedOperator} onChange={onChange(ChangeType.Operator)} />
      <Select
        options={valuesAsOptions}
        isSearchable
        value={selectedValue}
        onChange={onChange(ChangeType.Value)}
        placeholder={valuesPlaceHolder}
      />
    </div>
  );
};
