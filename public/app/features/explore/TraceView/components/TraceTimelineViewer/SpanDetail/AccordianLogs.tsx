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
import { Icon, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { TNil } from '../../types';
import { TraceLog, TraceKeyValuePair, TraceLink } from '../../types/trace';
import { formatDuration } from '../utils';

import AccordianKeyValues from './AccordianKeyValues';

import { alignIcon } from '.';

const getStyles = (theme: GrafanaTheme2) => ({
  AccordianLogs: css({
    label: 'AccordianLogs',
    border: `1px solid ${autoColor(theme, '#d8d8d8')}`,
    position: 'relative',
    marginBottom: '0.25rem',
  }),
  AccordianLogsHeader: css({
    label: 'AccordianLogsHeader',
    background: autoColor(theme, '#e4e4e4'),
    color: 'inherit',
    display: 'block',
    padding: '0.25rem 0.5rem',
    '&:hover': {
      background: autoColor(theme, '#dadada'),
    },
  }),
  AccordianLogsContent: css({
    label: 'AccordianLogsContent',
    background: autoColor(theme, '#f0f0f0'),
    borderTop: `1px solid ${autoColor(theme, '#d8d8d8')}`,
    padding: '0.5rem 0.5rem 0.25rem 0.5rem',
  }),
  AccordianLogsFooter: css({
    label: 'AccordianLogsFooter',
    color: autoColor(theme, '#999'),
  }),
  AccordianKeyValuesItem: css({
    marginBottom: theme.spacing(0.5),
  }),
});

export type AccordianLogsProps = {
  interactive?: boolean;
  isOpen: boolean;
  linksGetter?: ((pairs: TraceKeyValuePair[], index: number) => TraceLink[]) | TNil;
  logs: TraceLog[];
  onItemToggle?: (log: TraceLog) => void;
  onToggle?: () => void;
  openedItems?: Set<TraceLog>;
  timestamp: number;
};

export default function AccordianLogs({
  interactive = true,
  isOpen,
  linksGetter,
  logs,
  openedItems,
  onItemToggle,
  onToggle,
  timestamp,
}: AccordianLogsProps) {
  let arrow: React.ReactNode | null = null;
  let HeaderComponent: 'span' | 'a' = 'span';
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? (
      <Icon name={'angle-down'} className={alignIcon} />
    ) : (
      <Icon name={'angle-right'} className="u-align-icon" />
    );
    HeaderComponent = 'a';
    headerProps = {
      'aria-checked': isOpen,
      onClick: onToggle,
      role: 'switch',
    };
  }

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.AccordianLogs}>
      <HeaderComponent className={styles.AccordianLogsHeader} {...headerProps}>
        {arrow} <strong>Events</strong> ({logs.length})
      </HeaderComponent>
      {isOpen && (
        <div className={styles.AccordianLogsContent}>
          {_sortBy(logs, 'timestamp').map((log, i) => (
            <AccordianKeyValues
              // `i` is necessary in the key because timestamps can repeat
              key={`${log.timestamp}-${i}`}
              className={i < logs.length - 1 ? styles.AccordianKeyValuesItem : null}
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
