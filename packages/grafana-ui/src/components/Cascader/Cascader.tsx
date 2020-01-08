import React from 'react';
import { Input } from '../Forms/Input/Input';
import { Icon } from '../Icon/Icon';
// @ts-ignore
import RCCascader, { CascaderOption } from 'rc-cascader';
// import { GrafanaTheme } from '@grafana/data';
// import { css, cx } from 'emotion';
// import { getFocusStyle, inputSizes, sharedInputStyle } from '../Forms/commonStyles';
// import { stylesFactory, useTheme } from '../../themes';
// import { getInputStyles } from '../Forms/Input/getInputStyles';

interface CascaderState {
  inputValue: string;
}
interface CascaderProps {
  separator?: string;
  options: CascaderOption[];
  onSelect(val: CascaderOption): void;
}

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      inputValue: '',
    };
    console.log(props.options);
  }

  onChange = (value: CascaderOption, selectedOptions: CascaderOption[]) => {
    this.setState({
      inputValue: selectedOptions.map(o => o.label).join(this.props.separator || '/'),
    });
    this.props.onSelect(value);
    console.log(value.slice(-1)[0]);
  };
  render() {
    return (
      <RCCascader options={this.props.options} onChange={this.onChange}>
        <Input value={this.state.inputValue} readOnly suffix={<Icon name="caret-down" />} />
      </RCCascader>
    );
  }
}
