import { css } from '@emotion/css';
import React from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';

export interface Props {
  title: string;
  collapsedInfo: string[];
  children: React.ReactNode;
}

export function QueryOptionGroup({ title, children, collapsedInfo }: Props) {
  const [isOpen, toggleOpen] = useToggle(false);
  const styles = useStyles2(getStyles);

  return (
    <Stack gap={0} direction="column">
      <div className={styles.header} onClick={toggleOpen} title="Click to edit options">
        <div className={styles.toggle}>
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
        </div>
        <h6 className={styles.title}>{title}</h6>
        {!isOpen && (
          <div className={styles.description}>
            {collapsedInfo.map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
        )}
      </div>
      {isOpen && <div className={styles.body}>{children}</div>}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    switchLabel: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    header: css({
      display: 'flex',
      cursor: 'pointer',
      alignItems: 'baseline',
      color: theme.colors.text.primary,
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
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
      paddingLeft: theme.spacing(2),
      gap: theme.spacing(2),
      display: 'flex',
    }),
    body: css({
      display: 'flex',
      paddingTop: theme.spacing(2),
      gap: theme.spacing(2),
      flexWrap: 'wrap',
    }),
    toggle: css({
      color: theme.colors.text.secondary,
      marginRight: `${theme.spacing(1)}`,
    }),
  };
};
