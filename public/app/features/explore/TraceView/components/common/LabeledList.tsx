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

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';

const getStyles = (divider: boolean) => (theme: GrafanaTheme2) => {
  return {
    LabeledList: css`
      label: LabeledList;
      list-style: none;
      margin: 0;
      padding: 0;
      ${divider &&
      `
        margin-right: -8px;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
      `}
    `,
    LabeledListItem: css`
      label: LabeledListItem;
      display: inline-block;
      ${divider &&
      `
        border-right: 1px solid ${autoColor(theme, '#ddd')};
        padding: 0 8px;
      `}
    `,
    LabeledListLabel: css`
      label: LabeledListLabel;
      color: ${theme.isLight ? '#999' : '#666'};
      margin-right: 0.25rem;
    `,
    LabeledListValue: css`
      label: LabeledListValue;
      margin-right: 0.55rem;
    `,
  };
};

type LabeledListProps = {
  className?: string;
  divider?: boolean;
  items: Array<{ key: string; label: React.ReactNode; value: React.ReactNode }>;
};

export default function LabeledList(props: LabeledListProps) {
  const { className, divider = false, items } = props;
  const styles = useStyles2(getStyles(divider));

  return (
    <ul className={cx(styles.LabeledList, className)}>
      {items.map(({ key, label, value }) => {
        return (
          <li className={styles.LabeledListItem} key={`${key}`}>
            <span className={styles.LabeledListLabel}>{label}</span>
            <strong className={styles.LabeledListValue}>{value}</strong>
          </li>
        );
      })}
    </ul>
  );
}
