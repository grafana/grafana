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
import _sortBy from 'lodash/sortBy';
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import { css } from 'emotion';

import AccordianKeyValues from './AccordianKeyValues';
import { formatDuration } from '../utils';
import { TNil } from '../../types';
import { Log, KeyValuePair, Link } from '../../types/trace';
import { autoColor, createStyle, Theme, useTheme } from '../../Theme';
import { uAlignIcon, ubMb1 } from '../../uberUtilityStyles';

const getStyles = createStyle((theme: Theme) => {
  return {
    AccordianLogs: css`
      label: AccordianLogs;
      border: 1px solid ${autoColor(theme, '#d8d8d8')};
      position: relative;
      margin-bottom: 0.25rem;
    `,
    AccordianLogsHeader: css`
      label: AccordianLogsHeader;
      background: ${autoColor(theme, '#e4e4e4')};
      color: inherit;
      display: block;
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#dadada')};
      }
    `,
    AccordianLogsContent: css`
      label: AccordianLogsContent;
      background: ${autoColor(theme, '#f0f0f0')};
      border-top: 1px solid ${autoColor(theme, '#d8d8d8')};
      padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    `,
    AccordianLogsFooter: css`
      label: AccordianLogsFooter;
      color: ${autoColor(theme, '#999')};
    `,
  };
});

type AccordianLogsProps = {
  interactive?: boolean;
  isOpen: boolean;
  linksGetter: ((pairs: KeyValuePair[], index: number) => Link[]) | TNil;
  logs: Log[];
  onItemToggle?: (log: Log) => void;
  onToggle?: () => void;
  openedItems?: Set<Log>;
  timestamp: number;
};

export default function AccordianLogs(props: AccordianLogsProps) {
  const { interactive, isOpen, linksGetter, logs, openedItems, onItemToggle, onToggle, timestamp } = props;
  let arrow: React.ReactNode | null = null;
  let HeaderComponent: 'span' | 'a' = 'span';
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? <IoIosArrowDown className={uAlignIcon} /> : <IoIosArrowRight className="u-align-icon" />;
    HeaderComponent = 'a';
    headerProps = {
      'aria-checked': isOpen,
      onClick: onToggle,
      role: 'switch',
    };
  }

  const styles = getStyles(useTheme());
  return (
    <div className={styles.AccordianLogs}>
      <HeaderComponent className={styles.AccordianLogsHeader} {...headerProps}>
        {arrow} <strong>Logs</strong> ({logs.length})
      </HeaderComponent>
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
