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

import { TNil } from '../types/index';
import { UIIcon, UIInput } from '../uiElementsContext';

type Props = {
  allowClear?: boolean;
  inputProps: Record<string, any>;
  location: Location;
  match: any;
  trackFindFunction?: (str: string | TNil) => void;
  value: string | undefined;
  onChange: (value: string) => void;
};

export default class UiFindInput extends React.PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    inputProps: {},
    trackFindFunction: undefined,
    value: undefined,
  };

  clearUiFind = () => {
    this.props.onChange('');
  };

  render() {
    const { allowClear, inputProps, value } = this.props;

    const suffix = (
      <>
        {allowClear && value && value.length && <UIIcon type="close" onClick={this.clearUiFind} />}
        {inputProps.suffix}
      </>
    );

    return (
      <UIInput
        autosize={null}
        placeholder="Find..."
        {...inputProps}
        onChange={e => this.props.onChange(e.target.value)}
        suffix={suffix}
        value={value}
      />
    );
  }
}
