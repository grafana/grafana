// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as React from 'react';
import _debounce from 'lodash/debounce';
import _isString from 'lodash/isString';

import { TNil } from '../types/index';
import { UIIcon, UIInput } from '../uiElementsContext';

type TOwnProps = {
  allowClear?: boolean;
  inputProps: Record<string, any>;
  location: Location;
  match: any;
  trackFindFunction?: (str: string | TNil) => void;
};

export type TExtractUiFindFromStateReturn = {
  uiFind: string | undefined;
};

type TProps = TOwnProps & TExtractUiFindFromStateReturn;

type StateType = {
  ownInputValue: string | undefined;
};

export default class UiFindInput extends React.PureComponent<TProps, StateType> {
  static defaultProps: Partial<TProps> = {
    inputProps: {},
    trackFindFunction: undefined,
    uiFind: undefined,
  };

  state: StateType = {
    ownInputValue: undefined,
  };

  updateUiFindQueryParam = _debounce((uiFind?: string) => {
    // TODO: implement this
  }, 250);

  clearUiFind = () => {
    this.updateUiFindQueryParam();
    this.updateUiFindQueryParam.flush();
  };

  handleInputBlur = () => {
    this.updateUiFindQueryParam.flush();
  };

  handleInputChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = evt.target;
    this.updateUiFindQueryParam(value);
  };

  render() {
    const { allowClear, inputProps } = this.props;

    const inputValue = _isString(this.state.ownInputValue) ? this.state.ownInputValue : this.props.uiFind;
    const suffix = (
      <>
        {allowClear && inputValue && inputValue.length && <UIIcon type="close" onClick={this.clearUiFind} />}
        {inputProps.suffix}
      </>
    );

    return (
      <UIInput
        autosize={null}
        placeholder="Find..."
        {...inputProps}
        onBlur={this.handleInputBlur}
        onChange={this.handleInputChange}
        suffix={suffix}
        value={inputValue}
      />
    );
  }
}
