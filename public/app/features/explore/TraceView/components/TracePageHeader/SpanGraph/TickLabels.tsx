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

import { css } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { formatDuration } from '../../utils/date';

const getStyles = () => {
  return {
    TickLabels: css`
      label: TickLabels;
      height: 1rem;
      position: relative;
    `,
    TickLabelsLabel: css`
      label: TickLabelsLabel;
      color: #717171;
      font-size: 0.7rem;
      position: absolute;
      user-select: none;
    `,
  };
};

type TickLabelsProps = {
  numTicks: number;
  duration: number;
};

export default function TickLabels(props: TickLabelsProps) {
  const { numTicks, duration } = props;
  const styles = useStyles2(getStyles);

  const ticks = [];
  for (let i = 0; i < numTicks + 1; i++) {
    const portion = i / numTicks;
    const style = portion === 1 ? { right: '0%' } : { left: `${portion * 100}%` };
    ticks.push(
      <div key={portion} className={styles.TickLabelsLabel} style={style} data-testid="tick">
        {formatDuration(duration * portion)}
      </div>
    );
  }

  return (
    <div className={styles.TickLabels} data-testid="TickLabels">
      {ticks}
    </div>
  );
}
