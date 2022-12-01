import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

enum InfoMode {
  Error = 'Error',
  Info = 'Info',
  Warning = 'Warning',
}

interface Props {
  data?: PanelData;
  errorMessage?: string;
}

export function PanelHeaderState(props: Props) {
  // TODO Fancy logic to determine if the panel is in an error state or if has notices to show
  const state = 'error';
  const styles = useStyles2(getStyles(state));

  if (!getInfoMode(state)) {
    return null;
  }
  const iconName = getInfoMode(state) === InfoMode.Info ? 'info-circle' : 'exclamation-triangle';
  const iconVariant = getInfoMode(state) === InfoMode.Warning ? 'primary' : 'secondary';

  return (
    <div className={styles.container}>
      <IconButton className={styles.buttonStyles} name={iconName} tooltip="default message" />
    </div>
  );
}

const getInfoMode = (state: string) => {
  switch (state) {
    case 'error':
      return InfoMode.Error;
    case 'info':
      return InfoMode.Info;
    case 'warning':
      return InfoMode.Warning;
    default:
      return undefined;
  }
};

const getStyles = (state: string) => (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      position: 'absolute',
      width: '100%',
      justifyContent: 'center',
    }),
    buttonStyles: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.components.panel.padding,
      width: '32px',
      height: '32px',
      borderRadius: 0,
      color: `${getInfoMode(state) === InfoMode.Warning ? '#000' : '#FFF'}`,
      '&:hover': {
        color: `${getInfoMode(state) === InfoMode.Warning ? '#000' : '#FFF'}`,
      },
    }),
    info: css({
      background: '#3D71D9',
    }),
    warning: css({
      background: '#F5B73D',
    }),
    error: css({
      background: '#D10E5C',
    }),
  };
};
