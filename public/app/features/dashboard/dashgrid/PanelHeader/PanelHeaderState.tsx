import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { ToolbarButtonVariant } from '@grafana/ui/src/components/ToolbarButton';

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
  const state = 'warning';
  const styles = useStyles2(getStyles(state));

  const mode = getInfoMode(state);
  if (!mode) {
    return null;
  }

  let variantType: ToolbarButtonVariant;
  switch (mode) {
    case InfoMode.Error:
      variantType = 'destructive';
      break;
    case InfoMode.Info:
      variantType = 'primary';
      break;
    case InfoMode.Warning:
      variantType = 'warning';
      break;
    default:
      variantType = 'default';
  }

  const iconName = getInfoMode(state) === InfoMode.Info ? 'info-circle' : 'exclamation-triangle';

  return (
    <div className={styles.container}>
      <ToolbarButton variant={variantType} className={styles.buttonStyles} icon={iconName} tooltip="default message" />
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
    }),
  };
};
