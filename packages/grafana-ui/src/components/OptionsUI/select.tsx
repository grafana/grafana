import React from 'react';

import { FieldConfigEditorProps, SelectFieldConfigSettings, SelectableValue } from '@grafana/data';

import { Select } from '../Select/Select';

interface State<T> {
  isLoading: boolean;
  options: Array<SelectableValue<T>>;
  priorOptions: Array<SelectableValue<T>>;
}

type Props<T> = FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>;

export class SelectValueEditor<T> extends React.PureComponent<Props<T>, State<T>> {
  state: State<T> = {
    isLoading: true,
    options: [],
    priorOptions: [],
  };

  componentDidMount() {
    this.updateOptions();
  }

  componentDidUpdate(oldProps: Props<T>) {
    const old = oldProps.item?.settings;
    const now = this.props.item?.settings;
    if (old !== now) {
      this.updateOptions();
    } else if (now?.getOptions) {
      const old = oldProps.context?.data;
      const now = this.props.context?.data;
      if (old !== now) {
        this.updateOptions();
      }
    }
  }

  updateOptions = async () => {
    const { item } = this.props;
    const { settings } = item;
    let options: Array<SelectableValue<T>> = item.settings?.options || [];
    if (settings?.getOptions) {
      options = await settings.getOptions(this.props.context);
    }
    if (this.state.options !== options) {
      this.setState({
        isLoading: false,
        options,
        priorOptions: this.state.options,
      });
    }
  };

  render() {
    const { options, priorOptions, isLoading } = this.state;
    const { value, onChange, item, context } = this.props;

    const { settings } = item;
    let current = options.find((v) => v.value === value);
    if (settings?.overrideCurrentValue) {
      current = settings.overrideCurrentValue(context, priorOptions as Array<SelectableValue<T>>, value as T, current);
    }
    if (!current && value) {
      current = {
        label: `${value}`,
        value,
      };
    }
    return (
      <Select<T>
        isLoading={isLoading}
        value={current}
        defaultValue={value}
        allowCustomValue={settings?.allowCustomValue}
        isClearable={settings?.isClearable}
        onChange={(e) => onChange(e?.value)}
        options={options}
      />
    );
  }
}
