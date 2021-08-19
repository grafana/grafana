import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React from 'react';
import { AlertLabel } from './AlertLabel';

type Props = { labels: Record<string, string>; className?: string };

export const AlertLabels = ({ labels, className }: Props) => {
  const styles = useStyles(getStyles);
  const pairs = Object.entries(labels).filter(([key]) => !(key.startsWith('__') && key.endsWith('__')));

  return (
    <div className={cx(styles.wrapper, className)}>
      {pairs.map(([key, value], index) => (
        <AlertLabel key={`${key}-${value}-${index}`} labelKey={key} value={value} />
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    & > * {
      margin-bottom: ${theme.spacing.xs};
      margin-right: ${theme.spacing.xs};
    }
    padding-bottom: ${theme.spacing.xs};
  `,
});
