// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup.tsx
import { css } from '@emotion/css';
import * as React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, useStyles2, Stack } from '@grafana/ui';

interface Props {
  title: string;
  collapsedInfo: string[];
  children: React.ReactNode;
}

export function QueryOptionGroup({ title, children, collapsedInfo }: Props) {
  const [isOpen, toggleOpen] = useToggle(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Collapse
        className={styles.collapse}
        collapsible
        isOpen={isOpen}
        onToggle={toggleOpen}
        label={
          <Stack gap={0}>
            <h6 className={styles.title}>{title}</h6>
            {!isOpen && (
              <div className={styles.description}>
                {collapsedInfo.map((x, i) => (
                  <span key={i}>{x}</span>
                ))}
              </div>
            )}
          </Stack>
        }
      >
        <div className={styles.body}>{children}</div>
      </Collapse>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    collapse: css({
      backgroundColor: 'unset',
      border: 'unset',
      marginBottom: 0,

      ['> button']: {
        padding: theme.spacing(0, 1),
      },
    }),
    wrapper: css({
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    }),
    title: css({
      flexGrow: 1,
      overflow: 'hidden',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      margin: 0,
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.bodySmall.fontWeight,
      paddingLeft: theme.spacing(2),
      gap: theme.spacing(2),
      display: 'flex',
    }),
    body: css({
      display: 'flex',
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
    tooltip: css({
      marginRight: theme.spacing(0.25),
    }),
  };
};
