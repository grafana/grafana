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

import { IconButton, Input } from '@grafana/ui';

import { TNil } from '../types';

type Props = {
  allowClear?: boolean;
  inputProps: Record<string, unknown>;
  location: Location;
  trackFindFunction?: (str: string | TNil) => void;
  value: string | undefined;
  onChange: (value: string) => void;
};

export default class SearchBarInput extends React.PureComponent<Props> {
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
        {inputProps.suffix}
        {allowClear && value && value.length && (
          <IconButton name="times" onClick={this.clearUiFind} tooltip="Clear input" />
        )}
      </>
    );

    return (
      <Input
        placeholder="Find..."
        {...inputProps}
        onChange={(e) => this.props.onChange(e.currentTarget.value)}
        suffix={suffix}
        value={value}
      />
    );
  }
}
