import React from 'react';
import { FieldConfigEditorProps, SelectFieldConfigSettings, SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';

interface State<T> {
  loading: boolean;
  options: Array<SelectableValue<T>>;
}

export class SelectValueEditor<T> extends React.PureComponent<
  FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>,
  State<T>
> {
  state: State<T> = {
    loading: true,
    options: [],
  };

  render() {
    const { value, onChange, item } = this.props;
    const { options } = this.state;

    const { settings } = item;
    const { allowCustomValue } = settings;
    // let options: Array<SelectableValue<T>> = item.settings?.options || [];
    // if (getOptions) {
    //   options = getOptions(context);
    // }
    let current = options.find(v => v.value === value);
    if (!current && value) {
      current = {
        label: `${value}`,
        value,
      };
    }
    return (
      <Select<T>
        value={current}
        defaultValue={value}
        allowCustomValue={allowCustomValue}
        onChange={e => onChange(e.value)}
        options={options}
      />
    );
  }
}
