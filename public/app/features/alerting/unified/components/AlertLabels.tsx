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

  return (
    <div className={styles.wrapper}>
      {Object.entries(labels).map(([k, v]) => (
        <AlertLabel key={`${k}-${v}`} labelKey={k} value={v} />
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
