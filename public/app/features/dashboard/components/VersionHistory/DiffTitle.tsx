import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';

import { DiffValues } from './DiffValues';
import { Diff, getDiffText } from './utils';

type DiffTitleProps = {
  diff?: Diff;
  title: string;
};

const replaceDiff: Diff = { op: 'replace', originalValue: undefined, path: [''], value: undefined, startLineNumber: 0 };

export const DiffTitle: React.FC<DiffTitleProps> = ({ diff, title }) => {
  const styles = useStyles2(getDiffTitleStyles);

  return diff ? (
    <>
      <Icon type="mono" name="circle" className={styles[diff.op]} /> <span className={styles.embolden}>{title}</span>{' '}
      <span>{getDiffText(diff, diff.path.length > 1)}</span> <DiffValues diff={diff} />
    </>
  ) : (
    <div className={styles.withoutDiff}>
      <Icon type="mono" name="circle" className={styles.replace} /> <span className={styles.embolden}>{title}</span>{' '}
      <span>{getDiffText(replaceDiff, false)}</span>
    </div>
  );
};

const getDiffTitleStyles = (theme: GrafanaTheme2) => ({
  embolden: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  add: css`
    color: ${theme.colors.success.main};
  `,
  replace: css`
    color: ${theme.colors.success.main};
  `,
  move: css`
    color: ${theme.colors.success.main};
  `,
  copy: css`
    color: ${theme.colors.success.main};
  `,
  _get: css`
    color: ${theme.colors.success.main};
  `,
  test: css`
    color: ${theme.colors.success.main};
  `,
  remove: css`
    color: ${theme.colors.success.main};
  `,
  withoutDiff: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
