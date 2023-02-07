import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Badge, useStyles2 } from '@grafana/ui';

interface Props {
  text: React.ReactNode;
  icon?: IconName;
}

export const AuthBadge = ({ text, icon }: Props) => {
  const styles = useStyles2(getStyles);

  return <Badge color="green" className={styles.badge} icon={icon} text={text} />;
};

export const OAuthBadge = () => {
  return <AuthBadge key="name" icon="cloud" text="OAuth2" />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css`
    background-color: ${theme.isDark ? '#464C54' : '#b2c0d3'};
    border-color: ${theme.isDark ? '#464C54' : '#b2c0d3'};
    color: ${theme.colors.text.primary};
    white-space: nowrap;
  `,
  detailsWrapper: css`
    align-items: center;
    display: flex;
  `,
  strong: css`
    color: ${theme.colors.text.primary};
  `,
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
});
