import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// const configPath = 'admin/authentication';
export const LOGO_SIZE = '48px';

type Props = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  configPath: string;
  badges?: JSX.Element[];
};

export function ProviderCard({ providerId, displayName, enabled, configPath, badges }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <a href={`${configPath}/${providerId}`} className={styles.container}>
      <h2 className={styles.name}>{displayName}</h2>
      <div className={styles.content}>
        <p>By {providerId}</p>
      </div>
      <div className={styles.status}>{enabled ? 'Configured' : 'Not configured'}</div>
    </a>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: grid;
      grid-template-columns: ${LOGO_SIZE} 1fr ${theme.spacing(3)};
      grid-template-rows: auto;
      gap: ${theme.spacing(2)};
      grid-auto-flow: row;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(3)};
      transition: ${theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      })};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
    content: css`
      grid-area: 3 / 1 / 4 / 3;
      color: ${theme.colors.text.secondary};
    `,
    status: css`
      grid-area: 4 / 1 / 4 / 4;
      color: ${theme.colors.text.secondary};
    `,
    name: css`
      grid-area: 2 / 1 / 3 / 3;
      align-self: center;
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin: 0;
    `,
  };
};
