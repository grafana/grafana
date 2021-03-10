import React from 'react';
import { useStyles, Icon, Button } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { Change } from './DiffGroup';
import { DiffValues } from './DiffValues';
import { getChangeText } from './DiffSummary';

type DiffTitleProps = {
  diff?: Change;
  title: string;
};

export const DiffTitle: React.FC<DiffTitleProps> = ({ diff, title }) => {
  const styles = useStyles(getDiffTitleStyles);
  return diff ? (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <Icon type="mono" name="circle" className={styles[diff.op]} /> <span className={styles.embolden}>{title}</span>{' '}
        <span>{getChangeText(diff.op)}</span> <DiffValues change={diff} />
      </div>
      <Button size="sm" variant="secondary">
        Go to ln:{diff.startLineNumber}
      </Button>
    </div>
  ) : (
    <div style={{ marginBottom: 16 }}>
      <Icon type="mono" name="circle" className={styles.replace} /> <span className={styles.embolden}>{title}</span>{' '}
      <span>{getChangeText('replace')}</span>
    </div>
  );
};

export const getDiffTitleStyles = (theme: GrafanaTheme) => ({
  embolden: css`
    font-weight: ${theme.typography.weight.bold};
  `,
  add: css`
    color: ${theme.palette.online};
  `,
  replace: css`
    color: ${theme.palette.warn};
  `,
  remove: css`
    color: ${theme.palette.critical};
  `,
});
