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

import { Tooltip } from '@grafana/ui';
import cx from 'classnames';
import { css } from 'emotion';
import React from 'react';
import DoubleRightIcon from 'react-icons/lib/fa/angle-double-right';
import RightIcon from 'react-icons/lib/fa/angle-right';
import { createStyle } from '../../Theme';

const getStyles = createStyle(() => {
  return {
    TimelineCollapser: css`
      align-items: center;
      display: flex;
      flex: none;
      justify-content: center;
      margin-right: 0.5rem;
    `,
    btn: css`
      color: rgba(0, 0, 0, 0.5);
      cursor: pointer;
      margin-right: 0.3rem;
      font-size: 1.5rem;
      padding: 0.1rem;
      &:hover {
        color: rgba(0, 0, 0, 0.85);
      }
    `,
    btnExpanded: css`
      transform: rotate(90deg);
    `,
  };
});

type CollapserProps = {
  onCollapseAll: () => void;
  onCollapseOne: () => void;
  onExpandOne: () => void;
  onExpandAll: () => void;
};

export default function TimelineCollapser(props: CollapserProps) {
  const { onExpandAll, onExpandOne, onCollapseAll, onCollapseOne } = props;
  const styles = getStyles();
  return (
    <div className={styles.TimelineCollapser} data-test-id="TimelineCollapser">
      <Tooltip content="Expand +1" placement="top">
        <span>
          <RightIcon onClick={onExpandOne} className={cx(styles.btn, styles.btnExpanded)} />
        </span>
      </Tooltip>
      <Tooltip content="Collapse +1" placement="top">
        <span>
          <RightIcon onClick={onCollapseOne} className={styles.btn} />
        </span>
      </Tooltip>
      <Tooltip content="Expand All" placement="top">
        <span>
          <DoubleRightIcon onClick={onExpandAll} className={cx(styles.btn, styles.btnExpanded)} />
        </span>
      </Tooltip>
      <Tooltip content="Collapse All" placement="top">
        <span>
          <DoubleRightIcon onClick={onCollapseAll} className={styles.btn} />
        </span>
      </Tooltip>
    </div>
  );
}
