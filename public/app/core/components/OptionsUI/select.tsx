import { PureComponent } from 'react';

import { StandardEditorProps, SelectFieldConfigSettings, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

interface State<T> {
  isLoading: boolean;
  options: Array<SelectableValue<T>>;
}

type Props<T> = StandardEditorProps<T, SelectFieldConfigSettings<T>>;

export class SelectValueEditor<T> extends PureComponent<Props<T>, State<T>> {
  state: State<T> = {
    isLoading: true,
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
      });
    }
  };

  render() {
    const { options, isLoading } = this.state;
    const { value, onChange, item } = this.props;

    const { settings } = item;
    let current = options.find((v) => v.value === value);
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
