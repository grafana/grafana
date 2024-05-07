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
import cx from 'classnames';
import * as React from 'react';

import { useStyles2 } from '@grafana/ui';

const getStyles = () => {
  return {
    row: css({
      display: 'flex',
      flex: '0 1 auto',
      flexDirection: 'row',
    }),
    rowCell: css({
      position: 'relative',
    }),
  };
};

type TTimelineRowProps = {
  children: React.ReactNode;
  className?: string;
};

interface TimelineRowCellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  width: number;
  style?: {};
}

export default function TimelineRow({ children, className = '', ...rest }: TTimelineRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.row, className)} {...rest}>
      {children}
    </div>
  );
}

export function TimelineRowCell({ children, className = '', width, style = {}, ...rest }: TimelineRowCellProps) {
  const widthPercent = `${width * 100}%`;
  const mergedStyle = { ...style, flexBasis: widthPercent, maxWidth: widthPercent };
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.rowCell, className)} style={mergedStyle} data-testid="TimelineRowCell" {...rest}>
      {children}
    </div>
  );
}

TimelineRow.Cell = TimelineRowCell;
