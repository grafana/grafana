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
  popupVisible: boolean;
}
interface CascaderProps {
  separator?: string;
  options: CascaderOption[];
  search?: boolean;
  onSelect(val: CascaderOption): void;
}

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  private flatOptions: { [key: string]: any[] };

  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      inputValue: '',
      search: props.search || false,
      popupVisible: false,
    };
    this.flatOptions = this.flattenOptions(props.options);
  }

  search(searchStr: string) {
    const results = [];
    for (const key in this.flatOptions) {
      if (key.match(searchStr)) {
        results.push({ path: key, value: this.flatOptions[key] });
      }
    }
    return results;
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
  onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ inputValue: e.target.value, popupVisible: false });
    console.log(this.search(e.target.value));
  };

  onChange = (value: CascaderOption, selectedOptions: CascaderOption[]) => {
    this.setState({
      inputValue: selectedOptions.map(o => o.label).join(this.props.separator || ' / '),
    });
    this.props.onSelect(value);
  };

  onPopupVisibleChange = (popupVisible: boolean) => {
    this.setState({ popupVisible });
  };

  render() {
    const { inputValue, popupVisible } = this.state;
    return (
      <RCCascader
        options={this.props.options}
        popupVisible={popupVisible}
        onPopupVisibleChange={this.onPopupVisibleChange}
        onChange={this.onChange}
      >
        <Input
          value={inputValue}
          readOnly={!this.props.search}
          suffix={<Icon name="caret-down" />}
          onChange={this.onInput}
          onKeyDown={() => {}}
        />
      </RCCascader>
    );
  }
}
