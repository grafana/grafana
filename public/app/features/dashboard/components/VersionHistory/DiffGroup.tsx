import { css } from '@emotion/css';
import { last } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DiffTitle } from './DiffTitle';
import { DiffValues } from './DiffValues';
import { Diff, getDiffText } from './utils';

type DiffGroupProps = {
  diffs: Diff[];
  title: string;
};

export const DiffGroup = ({ diffs, title }: DiffGroupProps) => {
  const styles = useStyles2(getStyles);

  if (diffs.length === 1) {
    return (
      <div className={styles.container} data-testid="diffGroup">
        <DiffTitle title={title} diff={diffs[0]} />
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="diffGroup">
      <DiffTitle title={title} />
      <ul className={styles.list}>
        {diffs.map((diff: Diff, idx: number) => {
          return (
            <li className={styles.listItem} key={`${last(diff.path)}__${idx}`}>
              <span>{getDiffText(diff)}</span> <DiffValues diff={diff} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background-color: ${theme.colors.background.secondary};
    font-size: ${theme.typography.h6.fontSize};
    margin-bottom: ${theme.spacing(2)};
    padding: ${theme.spacing(2)};
  `,
  list: css`
    margin-left: ${theme.spacing(4)};
  `,
  listItem: css`
    margin-bottom: ${theme.spacing(1)};
  `,
});
