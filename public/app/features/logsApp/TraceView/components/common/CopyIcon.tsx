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
import React, { useState } from 'react';

import { Button, IconName, Tooltip, useStyles2 } from '@grafana/ui';

const getStyles = () => {
  return {
    CopyIcon: css`
      background-color: transparent;
      border: none;
      color: inherit;
      height: 100%;
      overflow: hidden;
      &:focus {
        background-color: rgba(255, 255, 255, 0.25);
        color: inherit;
      }
    `,
  };
};

type PropsType = {
  className?: string;
  copyText: string;
  icon?: IconName;
  tooltipTitle: string;
};

export default function CopyIcon(props: PropsType) {
  const styles = useStyles2(getStyles);

  const [hasCopied, setHasCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(props.copyText);
    setHasCopied(true);
  };

  return (
    <Tooltip content={hasCopied ? 'Copied' : props.tooltipTitle}>
      <Button className={cx(styles.CopyIcon)} type="button" icon={props.icon} onClick={handleClick} />
    </Tooltip>
  );
}

CopyIcon.defaultProps = {
  icon: 'copy',
  className: undefined,
};
