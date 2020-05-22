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
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import { css } from 'emotion';
import cx from 'classnames';

import * as markers from './AccordianKeyValues.markers';
import KeyValuesTable from './KeyValuesTable';
import { TNil } from '../../types';
import { KeyValuePair, Link } from '../../types/trace';
import { autoColor, createStyle, Theme, useTheme } from '../../Theme';
import { uAlignIcon, uTxEllipsis } from '../../uberUtilityStyles';

export const getStyles = createStyle((theme: Theme) => {
  return {
    header: css`
      label: header;
      cursor: pointer;
      overflow: hidden;
      padding: 0.25em 0.1em;
      text-overflow: ellipsis;
      white-space: nowrap;
      &:hover {
        background: ${autoColor(theme, '#e8e8e8')};
      }
    `,
    headerEmpty: css`
      label: headerEmpty;
      background: none;
      cursor: initial;
    `,
    headerHighContrast: css`
      label: headerHighContrast;
      &:hover {
        background: ${autoColor(theme, '#ddd')};
      }
    `,
    emptyIcon: css`
      label: emptyIcon;
      color: ${autoColor(theme, '#aaa')};
    `,
    summary: css`
      label: summary;
      display: inline;
      list-style: none;
      padding: 0;
    `,
    summaryItem: css`
      label: summaryItem;
      display: inline;
      margin-left: 0.7em;
      padding-right: 0.5rem;
      border-right: 1px solid ${autoColor(theme, '#ddd')};
      &:last-child {
        padding-right: 0;
        border-right: none;
      }
    `,
    summaryLabel: css`
      label: summaryLabel;
      color: ${autoColor(theme, '#777')};
    `,
    summaryDelim: css`
      label: summaryDelim;
      color: ${autoColor(theme, '#bbb')};
      padding: 0 0.2em;
    `,
  };
});

type AccordianKeyValuesProps = {
  className?: string | TNil;
  data: KeyValuePair[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  label: string;
  linksGetter: ((pairs: KeyValuePair[], index: number) => Link[]) | TNil;
  onToggle?: null | (() => void);
};

// export for tests
export function KeyValuesSummary(props: { data?: KeyValuePair[] }) {
  const { data } = props;
  if (!Array.isArray(data) || !data.length) {
    return null;
  }
  const styles = getStyles(useTheme());
  return (
    <ul className={styles.summary}>
      {data.map((item, i) => (
        // `i` is necessary in the key because item.key can repeat
        <li className={styles.summaryItem} key={`${item.key}-${i}`}>
          <span className={styles.summaryLabel}>{item.key}</span>
          <span className={styles.summaryDelim}>=</span>
          {String(item.value)}
        </li>
      ))}
    </ul>
  );
}

KeyValuesSummary.defaultProps = {
  data: null,
};

export default function AccordianKeyValues(props: AccordianKeyValuesProps) {
  const { className, data, highContrast, interactive, isOpen, label, linksGetter, onToggle } = props;
  const isEmpty = !Array.isArray(data) || !data.length;
  const styles = getStyles(useTheme());
  const iconCls = cx(uAlignIcon, { [styles.emptyIcon]: isEmpty });
  let arrow: React.ReactNode | null = null;
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? <IoIosArrowDown className={iconCls} /> : <IoIosArrowRight className={iconCls} />;
    headerProps = {
      'aria-checked': isOpen,
      onClick: isEmpty ? null : onToggle,
      role: 'switch',
    };
  }

  return (
    <div className={cx(className, uTxEllipsis)}>
      <div
        className={cx(styles.header, {
          [styles.headerEmpty]: isEmpty,
          [styles.headerHighContrast]: highContrast && !isEmpty,
        })}
        {...headerProps}
        data-test-id="AccordianKeyValues--header"
      >
        {arrow}
        <strong data-test={markers.LABEL}>
          {label}
          {isOpen || ':'}
        </strong>
        {!isOpen && <KeyValuesSummary data={data} />}
      </div>
      {isOpen && <KeyValuesTable data={data} linksGetter={linksGetter} />}
    </div>
  );
}

AccordianKeyValues.defaultProps = {
  className: null,
  highContrast: false,
  interactive: true,
  onToggle: null,
};
