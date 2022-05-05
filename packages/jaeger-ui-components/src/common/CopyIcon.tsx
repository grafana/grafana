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

import { css } from '@emotion/css';
import cx from 'classnames';
import copy from 'copy-to-clipboard';
import * as React from 'react';

import { Button, IconName, stylesFactory, Tooltip } from '@grafana/ui';

const getStyles = stylesFactory(() => {
  return {
    CopyIcon: css`
      background-color: transparent;
      border: none;
      color: inherit;
      height: 100%;
      overflow: hidden;
      padding: 0px;
      &:focus {
        background-color: rgba(255, 255, 255, 0.25);
        color: inherit;
      }
    `,
  };
});

type PropsType = {
  className?: string;
  copyText: string;
  icon?: IconName;
  tooltipTitle: string;
};

type StateType = {
  hasCopied: boolean;
};

export default class CopyIcon extends React.PureComponent<PropsType, StateType> {
  static defaultProps: Partial<PropsType> = {
    className: undefined,
    icon: 'copy',
  };

  state = {
    hasCopied: false,
  };

  handleClick = () => {
    this.setState({
      hasCopied: true,
    });
    copy(this.props.copyText);
  };

  handleTooltipVisibilityChange = (visible: boolean) => {
    if (!visible && this.state.hasCopied) {
      this.setState({
        hasCopied: false,
      });
    }
  };

  render() {
    const styles = getStyles();
    return (
      <Tooltip content={this.state.hasCopied ? 'Copied' : this.props.tooltipTitle}>
        <Button
          className={cx(styles.CopyIcon, this.props.className)}
          type="button"
          icon={this.props.icon}
          onClick={this.handleClick}
        />
      </Tooltip>
    );
  }
}
