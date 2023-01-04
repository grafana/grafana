import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';

export interface Props {
  message?: string;
  onClick?: (e: React.SyntheticEvent) => void;
}

export function PanelStatus({ message, onClick }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButton
      onClick={onClick}
      variant={'destructive'}
      className={styles.buttonStyles}
      icon="exclamation-triangle"
      tooltip={message || ''}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const { headerHeight, padding } = theme.components.panel;

  return {
    buttonStyles: css({
      label: 'panel-header-state-button',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(padding),
      width: theme.spacing(headerHeight),
      height: theme.spacing(headerHeight),
      borderRadius: 0,
    }),
  };
};
