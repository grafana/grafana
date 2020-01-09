import React from 'react';
import { Input } from '../Forms/Input/Input';
import { Icon } from '../Icon/Icon';
// @ts-ignore
import RCCascader, { CascaderOption } from 'rc-cascader';
// import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
// import { getFocusStyle, inputSizes, sharedInputStyle } from '../Forms/commonStyles';
// import { stylesFactory, useTheme } from '../../themes';
// import { getInputStyles } from '../Forms/Input/getInputStyles';

const searchStyles = {
  container: css`
    position: absolute;
    min-height: 80px;
    width: 80px;
    bacgkround-color: green;
  `,
  item: css`
    background-color: green;
  `,
};

interface CascaderState {
  inputValue: string;
  search: boolean;
  searchResults: Array<{
    path: string;
    value: any[];
  }>;
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
      searchResults: [],
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

  renderSearchResults = () => {
    return (
      <div className={searchStyles.container}>
        {this.state.searchResults.map(result => (
          <div
            className={searchStyles.item}
            key={result.path}
            onClick={() => {
              this.setState({ inputValue: result.path, search: false });
              this.props.onSelect(result.value);
            }}
          >
            {result.path}
          </div>
        ))}
      </div>
    );
  };

  flattenOptions = (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
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
  };
  onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      inputValue: e.target.value,
      popupVisible: false,
      search: true,
      searchResults: this.search(e.target.value),
    });

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
    const { inputValue, popupVisible, search } = this.state;
    return (
      <div style={{ position: 'relative' }}>
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
            onKeyDown={() => {}} //  rc-cascader blocks certain keys unless there is an onKeyDown on the children
          />
        </RCCascader>
        {search ? this.renderSearchResults() : ''}
      </div>
    );
  }
}
