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
import { sortBy as _sortBy } from 'lodash';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { TNil } from '../../types';
import { TraceLog, TraceKeyValuePair, TraceLink } from '../../types/trace';
import { ubMb1 } from '../../uberUtilityStyles';
import { formatDuration } from '../utils';

import AccordianKeyValues from './AccordianKeyValues';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    AccordianLogs: css`
      label: AccordianLogs;
    `,
    AccordianLogsContent: css`
      label: AccordianLogsContent;
    `,
    AccordianLogsFooter: css`
      label: AccordianLogsFooter;
      color: ${autoColor(theme, '#999')};
    `,
  };
};

export type AccordianLogsProps = {
  interactive?: boolean;
  isOpen: boolean;
  linksGetter: ((pairs: TraceKeyValuePair[], index: number) => TraceLink[]) | TNil;
  logs: TraceLog[];
  onItemToggle?: (log: TraceLog) => void;
  openedItems?: Set<TraceLog>;
  timestamp: number;
};

export default function AccordianLogs(props: AccordianLogsProps) {
  const { interactive, isOpen, linksGetter, logs, openedItems, onItemToggle, timestamp } = props;

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.AccordianLogs}>
      {isOpen && (
        <div className={styles.AccordianLogsContent}>
          {_sortBy(logs, 'timestamp').map((log, i) => (
            <AccordianKeyValues
              // `i` is necessary in the key because timestamps can repeat
              key={`${log.timestamp}-${i}`}
              className={i < logs.length - 1 ? ubMb1 : null}
              data={log.fields || []}
              highContrast
              interactive={interactive}
              isOpen={openedItems ? openedItems.has(log) : false}
              label={`${formatDuration(log.timestamp - timestamp)}`}
              linksGetter={linksGetter}
              onToggle={interactive && onItemToggle ? () => onItemToggle(log) : null}
            />
          ))}
          <small className={styles.AccordianLogsFooter}>
            Log timestamps are relative to the start time of the full trace.
          </small>
        </div>
      )}
    </div>
  );
}

AccordianLogs.defaultProps = {
  interactive: true,
  linksGetter: undefined,
  onItemToggle: undefined,
  onToggle: undefined,
  openedItems: undefined,
};
