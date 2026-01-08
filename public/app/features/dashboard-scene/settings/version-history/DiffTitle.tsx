import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';

import { DiffValues } from './DiffValues';
import { Diff, getDiffText } from './utils';

type DiffTitleProps = {
  diff?: Diff;
  title: string;
};

const replaceDiff: Diff = {
  op: 'replace',
  originalValue: undefined,
  path: [''],
  value: undefined,
  startLineNumber: 0,
  endLineNumber: 0,
};

export const DiffTitle = ({ diff, title }: DiffTitleProps) => {
  const styles = useStyles2(getDiffTitleStyles);

  return diff ? (
    <>
      <Icon type="mono" name="circle" className={styles[diff.op]} size="xs" />{' '}
      <span className={styles.embolden}>{title}</span> <span>{getDiffText(diff, diff.path?.length > 1)}</span>{' '}
      <DiffValues diff={diff} />
    </>
  ) : (
    <div className={styles.withoutDiff}>
      <Icon type="mono" name="circle" className={styles.replace} size="xs" />{' '}
      <span className={styles.embolden}>{title}</span> <span>{getDiffText(replaceDiff, false)}</span>
    </div>
  );
};

const getDiffTitleStyles = (theme: GrafanaTheme2) => ({
  embolden: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  add: css({
    color: theme.colors.success.main,
  }),
  replace: css({
    color: theme.colors.warning.main,
  }),
  move: css({
    color: theme.colors.warning.main,
  }),
  copy: css({
    color: theme.colors.success.main,
  }),
  _get: css({
    color: theme.colors.success.main,
  }),
  test: css({
    color: theme.colors.success.main,
  }),
  remove: css({
    color: theme.colors.error.main,
  }),
  withoutDiff: css({
    marginBottom: theme.spacing(1),
  }),
});
