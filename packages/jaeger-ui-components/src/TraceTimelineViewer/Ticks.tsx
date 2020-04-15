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

import * as React from 'react';
import { css } from 'emotion';
import cx from 'classnames';

import { formatDuration } from './utils';
import { TNil } from '../types';
import { autoColor, createStyle, Theme, useTheme } from '../Theme';

const getStyles = createStyle((theme: Theme) => {
  return {
    Ticks: css`
      label: Ticks;
      pointer-events: none;
    `,
    TicksTick: css`
      label: TicksTick;
      position: absolute;
      height: 100%;
      width: 1px;
      background: ${autoColor(theme, '#d8d8d8')};
      &:last-child {
        width: 0;
      }
    `,
    TicksTickLabel: css`
      label: TicksTickLabel;
      left: 0.25rem;
      position: absolute;
    `,
    TicksTickLabelEndAnchor: css`
      label: TicksTickLabelEndAnchor;
      left: initial;
      right: 0.25rem;
    `,
  };
});

type TicksProps = {
  endTime?: number | TNil;
  numTicks: number;
  showLabels?: boolean | TNil;
  startTime?: number | TNil;
};

export default function Ticks(props: TicksProps) {
  const { endTime, numTicks, showLabels, startTime } = props;

  let labels: undefined | string[];
  if (showLabels) {
    labels = [];
    const viewingDuration = (endTime || 0) - (startTime || 0);
    for (let i = 0; i < numTicks; i++) {
      const durationAtTick = (startTime || 0) + (i / (numTicks - 1)) * viewingDuration;
      labels.push(formatDuration(durationAtTick));
    }
  }
  const styles = getStyles(useTheme());
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < numTicks; i++) {
    const portion = i / (numTicks - 1);
    ticks.push(
      <div
        key={portion}
        className={styles.TicksTick}
        style={{
          left: `${portion * 100}%`,
        }}
      >
        {labels && (
          <span className={cx(styles.TicksTickLabel, { [styles.TicksTickLabelEndAnchor]: portion >= 1 })}>
            {labels[i]}
          </span>
        )}
      </div>
    );
  }
  return <div className={styles.Ticks}>{ticks}</div>;
}

Ticks.defaultProps = {
  endTime: null,
  showLabels: null,
  startTime: null,
};
