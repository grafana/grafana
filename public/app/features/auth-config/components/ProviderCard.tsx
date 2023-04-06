import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Card, useStyles2 } from '@grafana/ui';

export const LOGO_SIZE = '48px';

type Props = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  configPath?: string;
  authType?: string;
  badges?: JSX.Element[];
};

export function ProviderCard({ providerId, displayName, enabled, configPath, authType, badges }: Props) {
  const styles = useStyles2(getStyles);
  const basePath = 'admin/authentication/';
  configPath = basePath + (configPath || providerId);

  return (
    <Card href={configPath} className={styles.container}>
      <Card.Heading className={styles.name}>{displayName}</Card.Heading>
      <div className={styles.footer}>
        {authType && <Badge text={authType} color="blue" icon="info-circle" />}
        {enabled ? (
          <Badge text="Enabled" color="green" icon="check" />
        ) : (
          <Badge text="Disabled" color="red" icon="times" />
        )}
      </div>
    </Card>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      min-height: ${theme.spacing(16)};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: ${theme.spacing(2)};
    `,
    header: css`
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: ${theme.spacing(2)};
    `,
    footer: css`
      display: flex;
      justify-content: space-between;
    `,
    name: css`
      align-self: flex-start;
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin: 0;
    `,
  };
};
