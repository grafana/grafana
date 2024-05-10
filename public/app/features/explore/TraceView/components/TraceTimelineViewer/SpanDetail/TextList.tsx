// Copyright (c) 2019 Uber Technologies, Inc.
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

const getStyles = () => ({
  TextList: css({
    maxHeight: '450px',
    overflow: 'auto',
  }),
  List: css({
    width: '100%',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  }),
  item: css({
    padding: '0.25rem 0.5rem',
    verticalAlign: 'top',
    '&:nth-child(2n)': {
      background: '#f5f5f5',
    },
  }),
});

type TextListProps = {
  data: string[];
};

export default function TextList(props: TextListProps) {
  const { data } = props;
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.TextList)} data-testid="TextList">
      <ul className={styles.List}>
        {data.map((row, i) => {
          return (
            // `i` is necessary in the key because row.key can repeat
            <li className={styles.item} key={`${i}`}>
              {row}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
