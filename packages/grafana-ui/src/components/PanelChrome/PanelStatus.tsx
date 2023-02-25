import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';

export interface Props {
  message?: string;
  onClick?: (e: React.SyntheticEvent) => void;
  ariaLabel?: string;
}

export function PanelStatus({ message, onClick, ariaLabel = 'status' }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ToolbarButton
      className={styles.buttonStyles}
      onClick={onClick}
      variant={'destructive'}
      icon="exclamation-triangle"
      iconSize="md"
      tooltip={message || ''}
      aria-label={ariaLabel}
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
