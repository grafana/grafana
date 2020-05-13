// Copyright (c) 2017 Uber Technologies, Inc.
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

import React from 'react';
import cx from 'classnames';
import { css, keyframes } from 'emotion';

import { createStyle } from '../Theme';
import { UIIcon } from '../uiElementsContext';

const getStyles = createStyle(() => {
  const LoadingIndicatorColorAnim = keyframes`
    /*
    rgb(0, 128, 128) == teal
    rgba(0, 128, 128, 0.3) == #bedfdf
    */
    from {
      color: #bedfdf;
    }
    to {
      color: teal;
    }
  `;
  return {
    LoadingIndicator: css`
      label: LoadingIndicator;
      animation: ${LoadingIndicatorColorAnim} 1s infinite alternate;
      font-size: 36px;
      /* outline / stroke the loading indicator */
      text-shadow: -0.5px 0 rgba(0, 128, 128, 0.6), 0 0.5px rgba(0, 128, 128, 0.6), 0.5px 0 rgba(0, 128, 128, 0.6),
        0 -0.5px rgba(0, 128, 128, 0.6);
    `,
    LoadingIndicatorCentered: css`
      label: LoadingIndicatorCentered;
      display: block;
      margin-left: auto;
      margin-right: auto;
    `,
    LoadingIndicatorSmall: css`
      label: LoadingIndicatorSmall;
      font-size: 0.7em;
    `,
  };
});

type LoadingIndicatorProps = {
  centered?: boolean;
  className?: string;
  small?: boolean;
};

export default function LoadingIndicator(props: LoadingIndicatorProps) {
  const { centered, className, small, ...rest } = props;
  const styles = getStyles();
  const cls = cx(styles.LoadingIndicator, {
    [styles.LoadingIndicatorCentered]: centered,
    [styles.LoadingIndicatorSmall]: small,
    className,
  });
  return <UIIcon type="loading" className={cls} {...rest} />;
}

LoadingIndicator.defaultProps = {
  centered: false,
  className: undefined,
  small: false,
};
