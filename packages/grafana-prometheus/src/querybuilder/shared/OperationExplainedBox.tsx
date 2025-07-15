// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/OperationExplainedBox.tsx
import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  title?: React.ReactNode;
  children?: React.ReactNode;
  markdown?: string;
  stepNumber?: number;
}

export function OperationExplainedBox({ title, stepNumber, markdown, children }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.box}>
      {stepNumber !== undefined && <div className={styles.stepNumber}>{stepNumber}</div>}
      <div className={styles.boxInner}>
        {title && (
          <div className={styles.header}>
            <span>{title}</span>
          </div>
        )}
        <div className={styles.body}>
          {markdown && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}></div>}
          {children}
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    box: css({
      background: theme.colors.background.secondary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      position: 'relative',
    }),
    boxInner: css({
      marginLeft: theme.spacing(4),
    }),
    stepNumber: css({
      fontWeight: theme.typography.fontWeightMedium,
      background: theme.colors.secondary.main,
      width: '20px',
      height: '20px',
      borderRadius: theme.shape.radius.circle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      top: '10px',
      left: '11px',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    header: css({
      paddingBottom: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    body: css({
      color: theme.colors.text.secondary,
      'p:last-child': {
        margin: 0,
      },
      a: {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
    }),
  };
};
