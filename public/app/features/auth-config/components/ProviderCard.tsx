import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Card, useStyles2, Icon, Tooltip } from '@grafana/ui';

import { BASE_PATH } from '../constants';

export const LOGO_SIZE = '48px';

type Props = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  configFoundInIniFile?: boolean;
  configPath?: string;
  authType?: string;
  badges?: JSX.Element[];
  onClick?: () => void;
};

export function ProviderCard({
  providerId,
  displayName,
  enabled,
  configFoundInIniFile,
  configPath,
  authType,
  badges,
  onClick,
}: Props) {
  const styles = useStyles2(getStyles);
  configPath = BASE_PATH + (configPath || providerId);

  return (
    <Card href={configPath} className={styles.container} onClick={() => onClick && onClick()}>
      <Card.Heading className={styles.name}>{displayName}</Card.Heading>
      {configFoundInIniFile && (
        <>
          <span className={styles.initext}>
            <Tooltip
              content={`Note: Settings enabled in the .ini configuration file will overwritten by the current settings.`}
            >
              <>
                <Icon name="adjust-circle" />
                Configuration found in .ini file
              </>
            </Tooltip>
          </span>
        </>
      )}
      <div className={styles.footer}>
        {authType && <Badge text={authType} color="blue" icon="info-circle" />}
        {enabled ? <Badge text="Enabled" color="green" icon="check" /> : <Badge text="Not enabled" color="red" />}
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
    initext: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(1)} 0; // Add some padding
      max-width: 90%; // Add a max-width to prevent text from stretching too wide
    `,
  };
};
