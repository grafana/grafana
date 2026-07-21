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

import { type GrafanaTheme2, type TraceLog } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Counter, Icon, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { formatDuration } from '../../utils/date';

import AccordionKeyValues from './AccordionKeyValues';

import { alignIcon } from '.';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    AccordionLogs: css({
      label: 'AccordionLogs',
      position: 'relative',
    }),
    AccordionLogsHeader: css({
      label: 'AccordionLogsHeader',
      color: 'inherit',
      display: 'flex',
      alignItems: 'center',
    }),
    AccordionLogsContent: css({
      label: 'AccordionLogsContent',
      background: autoColor(theme, '#f0f0f0'),
      padding: '0.5rem 0.5rem 0.25rem 0.5rem',
    }),
    AccordionLogsFooter: css({
      label: 'AccordionLogsFooter',
      color: theme.colors.text.secondary,
    }),
    AccordionKeyValuesItem: css({
      marginBottom: theme.spacing(0.5),
    }),
    parenthesis: css({
      color: theme.colors.text.secondary,
    }),
  };
};

export type AccordionLogsProps = {
  interactive?: boolean;
  isOpen: boolean;
  logs: TraceLog[];
  onItemToggle?: (log: TraceLog) => void;
  onToggle?: () => void;
  openedItems?: Set<TraceLog>;
  timestamp: number;
};

export default function AccordionLogs({
  interactive = true,
  isOpen,
  logs,
  openedItems,
  onItemToggle,
  onToggle,
  timestamp,
}: AccordionLogsProps) {
  let arrow: React.ReactNode | null = null;
  let HeaderComponent: 'span' | 'a' = 'span';
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? (
      <Icon name={'angle-down'} className={alignIcon} />
    ) : (
      <Icon name={'angle-right'} className="u-align-icon" style={{ margin: '0 0.25rem 0 0' }} />
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
    <div className={styles.AccordionLogs}>
      <HeaderComponent className={styles.AccordionLogsHeader} {...headerProps}>
        {arrow}{' '}
        <strong>
          <Trans i18nKey="explore.accordian-logs.events">Events</Trans>
        </strong>{' '}
        <Counter value={logs.length} variant="secondary" />
      </HeaderComponent>
      {isOpen && (
        <div className={styles.AccordionLogsContent}>
          {_sortBy(logs, 'timestamp').map((log, i) => {
            const formattedDuration = formatDuration(log.timestamp - timestamp);
            const truncateLogNameInSummary = log.name && log.name.length > 20;
            const formattedLogName = log.name && truncateLogNameInSummary ? log.name.slice(0, 20) + '...' : log.name;
            const label = formattedLogName ? (
              <span>
                {formattedDuration} <span>({formattedLogName})</span>
              </span>
            ) : (
              formattedDuration
            );
            return (
              <AccordionKeyValues
                // `i` is necessary in the key because timestamps can repeat
                key={`${log.timestamp}-${i}`}
                className={i < logs.length - 1 ? styles.AccordionKeyValuesItem : null}
                data={log.fields || []}
                logName={truncateLogNameInSummary ? log.name : undefined}
                highContrast
                interactive={interactive}
                isOpen={openedItems ? openedItems.has(log) : false}
                label={label}
                onToggle={interactive && onItemToggle ? () => onItemToggle(log) : null}
              />
            );
          })}
          <small className={styles.AccordionLogsFooter}>
            <Trans i18nKey="explore.accordian-logs.footer">
              Event timestamps are relative to the start time of the full trace.
            </Trans>
          </small>
        </div>
      )}
    </div>
  );
}
