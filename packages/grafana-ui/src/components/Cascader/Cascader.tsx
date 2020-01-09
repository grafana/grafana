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
  search: boolean;
}
interface CascaderProps {
  separator?: string;
  options: CascaderOption[];
  search?: boolean;
  onSelect(val: CascaderOption): void;
}

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      inputValue: '',
      search: props.search || false,
    };
    console.log(this.flattenOptions(props.options));
  }

  flattenOptions(options: CascaderOption[], optionPath: CascaderOption[] = []) {
    const stringArrayMap: { [key: string]: any[] } = {};
    for (const option of options) {
      const cpy = [...optionPath];
      //   console.log(cpy);
      cpy.push(option);
      if (!option.children) {
        const locationString = cpy.map(o => o.label).join(this.props.separator || ' / ');
        stringArrayMap[locationString] = cpy.map(o => o.value);
        // console.log('out of children: ', locationString);
      } else {
        // console.log('Next level');
        Object.assign(stringArrayMap, this.flattenOptions(option.children, cpy));
      }
    }

    return stringArrayMap;
    // console.log(stringArrayMap);
  }

  onChange = (value: CascaderOption, selectedOptions: CascaderOption[]) => {
    this.setState({
      inputValue: selectedOptions.map(o => o.label).join(this.props.separator || ' / '),
    });
    this.props.onSelect(value);
  };

  render() {
    return (
      <RCCascader options={this.props.options} onChange={this.onChange}>
        <Input value={this.state.inputValue} readOnly={!this.props.search} suffix={<Icon name="caret-down" />} />
      </RCCascader>
    );
  }
}
