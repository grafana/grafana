import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';

export interface Props {
  state?: LoadingState;
  message?: string;
  onClick?: () => void;
}

export function PanelStatus({ state, message, onClick }: Props) {
  const styles = useStyles2(getStyles);
  const hasError = state === LoadingState.Error || message;

  return hasError ? (
    <ToolbarButton
      onClick={onClick}
      variant={'destructive'}
      className={styles.buttonStyles}
      icon="exclamation-triangle"
      tooltip={message || ''}
    />
  ) : null;
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
