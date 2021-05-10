import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { FC } from 'react';
import { AlertLabel } from './AlertLabel';

interface Props {
  labels: Record<string, string>;
}

export const AlertLabels: FC<Props> = ({ labels }) => {
  const styles = useStyles(getStyles);

  // transform to array of key value pairs and filter out "private" labels that start and end with double underscore
  const pairs = Object.entries(labels).filter(([key]) => !(key.startsWith('__') && key.endsWith('__')));

  return (
    <div className={styles.wrapper}>
      {pairs.map(([key, value]) => (
        <AlertLabel key={`${key}-${value}`} labelKey={key} value={value} />
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    & > * {
      margin-top: ${theme.spacing.xs};
      margin-right: ${theme.spacing.xs};
    }
    padding-bottom: ${theme.spacing.xs};
  `,
});
