import React from 'react';
import _ from 'lodash';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { DiffTitle } from './DiffTitle';
import { DiffValues } from './DiffValues';
import { Diff, getChangeText } from './utils';

type DiffGroupProps = {
  diffs: Diff[];
  title: string;
};

const isNotNumeric = (value: string) => _.isNaN(_.toNumber(value));
const isNotEmptyArray = (value: any) => _.isArray(value) && !_.isEmpty(value);

export const DiffGroup: React.FC<DiffGroupProps> = ({ diffs, title }) => {
  const styles = useStyles(getStyles);

  if (diffs.length === 1) {
    return (
      <div className={styles.container}>
        <DiffTitle title={title} diff={diffs[0]} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DiffTitle title={title} />
      <ul className={styles.list}>
        {diffs.map((diff: Diff, idx: number) => {
          return (
            <li className={styles.listItem} key={`${_.last(diff.path)}__${idx}`}>
              <span>{getChangeText(diff.op)}</span> {isNotEmptyArray(diff.value) && <span>{diff.value.length}</span>}{' '}
              {isNotEmptyArray(diff.originalValue) && <span>{diff.originalValue.length}</span>}{' '}
              <span>{isNotNumeric(_.last(diff.path)!) && _.last(diff.path)}</span> <DiffValues diff={diff} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  container: css`
    background-color: ${theme.colors.bg2};
    font-size: ${theme.typography.size.md};
    margin-bottom: ${theme.spacing.md};
    padding: ${theme.spacing.md};
  `,
  list: css`
    margin-left: ${theme.spacing.xl};
  `,
  listItem: css`
    margin-bottom: ${theme.spacing.sm};
  `,
});
