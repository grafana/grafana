import React from 'react';
import { FieldConfigEditorProps, SelectFieldConfigSettings, SelectableValue } from '@grafana/data';
import { Select } from '../Select/Select';
import { Icon } from '../Icon/Icon';

interface State<T> {
  loading: boolean;
  options: Array<SelectableValue<T>>;
}

type Props<T> = FieldConfigEditorProps<T, SelectFieldConfigSettings<T>>;

export class SelectValueEditor<T> extends React.PureComponent<Props<T>, State<T>> {
  state: State<T> = {
    loading: true,
    options: [],
  };

  componentDidMount() {
    this.updateOptions();
  }

  componentDidUpdate(oldProps: Props<T>) {
    const old = oldProps.item?.settings;
    const now = this.props.item?.settings;
    if (old !== now) {
      this.updateOptions();
    } else if (now.getOptions) {
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
        loading: false,
        options,
      });
    }
  };

  render() {
    const { options, loading } = this.state;
    if (loading) {
      return <Icon name="fa fa-spinner" />;
    }
    const { value, onChange, item } = this.props;

    const { settings } = item;
    const { allowCustomValue } = settings;
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
