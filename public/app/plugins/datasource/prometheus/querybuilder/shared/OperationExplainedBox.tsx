import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

export interface Props {
  title: string;
  children: React.ReactNode;
  stepNumber: number;
}

export function OperationExplainedBox({ title, stepNumber, children }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.box}>
      <div className={styles.stepNumber}>{stepNumber}</div>
      <div className={styles.boxInner}>
        <div className={styles.header}>
          <span>{title}</span>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    box: css({
      background: theme.colors.background.secondary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius(),
      position: 'relative',
      marginBottom: theme.spacing(0.5),
    }),
    boxInner: css({
      marginLeft: theme.spacing(4),
    }),
    stepNumber: css({
      fontWeight: theme.typography.fontWeightMedium,
      background: theme.colors.secondary.main,
      width: theme.spacing(3),
      height: theme.spacing(3),
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: '7px',
      left: theme.spacing(1),
    }),
    header: css({
      paddingBottom: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    body: css({
      color: theme.colors.text.secondary,
    }),
  };
};
