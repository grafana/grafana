import React from 'react';
import { Input } from '../Forms/Input/Input';
import { Icon } from '../Icon/Icon';
// @ts-ignore
import RCCascader, { CascaderOption } from 'rc-cascader';
// import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';
import { useTheme } from '../../themes';
// import { getInputStyles } from '../Forms/Input/getInputStyles';

const searchStyles = {
  container: css`
    position: absolute;
    width: 100px;
    margin-top: 5px;
    padding: 3px 0;
  `,
  item: css`
    &: hover {
      cursor: pointer;
    }
  `,
  selected: css`
    text-decoration: underline;
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
  selected: number;
}
interface CascaderProps {
  separator?: string;
  options: CascaderOption[];
  onSelect(val: CascaderOption): void;
}

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  private flatOptions: { [key: string]: any[] };

  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      inputValue: '',
      search: false,
      searchResults: [],
      popupVisible: false,
      selected: 0,
    };
    this.flatOptions = this.flattenOptions(props.options);
  }

  search(searchStr: string) {
    const results = [];
    for (const key in this.flatOptions) {
      if (key.match(searchStr) && searchStr !== '') {
        results.push({ path: key, value: this.flatOptions[key] });
      }
    }
    return results;
  }

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
      selected: 0,
      searchResults: this.search(e.target.value),
    });

    console.log(this.search(e.target.value));
  };

  onChange = (value: CascaderOption, selectedOptions: CascaderOption[]) => {
    this.setState({
      inputValue: selectedOptions.map(o => o.label).join(this.props.separator || ' / '),
      search: false,
      searchResults: [],
    });
    this.props.onSelect(value);
  };

  onSearchSelect = (path: string, value: any[]) => {
    this.setState({ inputValue: path, search: false, searchResults: [] });
    this.props.onSelect(value);
  };

  onPopupVisibleChange = (popupVisible: boolean) => {
    this.setState({ popupVisible, search: popupVisible ? false : this.state.search });
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.setState({
        selected: this.state.selected ? this.state.selected - 1 : 0,
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.setState({
        selected:
          this.state.selected === this.state.searchResults.length - 1
            ? this.state.searchResults.length - 1
            : this.state.selected + 1,
      });
    }
  };

  render() {
    const { inputValue, popupVisible, search } = this.state;

    console.log(this.state.selected);
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
            suffix={<Icon name="caret-down" />}
            onChange={this.onInput}
            onKeyDown={this.onKeyDown}
          />
        </RCCascader>
        {search && this.state.searchResults.length ? (
          <SearchResults
            selected={this.state.selected}
            searchResults={this.state.searchResults}
            onSelect={this.onSearchSelect}
          />
        ) : (
          ''
        )}
      </div>
    );
  }
}

interface SearchResultProps {
  onSelect(path: string, val: any[]): void;
  searchResults: Array<{
    path: string;
    value: any[];
  }>;
  selected: number;
}

const SearchResults = (props: SearchResultProps) => {
  const theme = useTheme();
  const styles = sharedInputStyle(theme);
  const focusStyle = getFocusStyle(theme);
  return (
    <div className={cx(searchStyles.container, styles)}>
      {props.searchResults.map((result, i) => (
        <div
          className={cx(searchStyles.item, focusStyle, props.selected === i ? searchStyles.selected : '')}
          key={result.path}
          onClick={() => {
            props.onSelect(result.path, result.value);
          }}
        >
          {result.path}
        </div>
      ))}
    </div>
  );
};
