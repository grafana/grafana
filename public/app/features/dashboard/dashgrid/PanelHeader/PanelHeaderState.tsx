import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { ToolbarButtonVariant } from '@grafana/ui/src/components/ToolbarButton';
import { InspectTab } from 'app/features/inspector/types';

enum InfoMode {
  Error = 'Error',
  Info = 'Info',
  Warning = 'Warning',
}

interface Props {
  data?: PanelData; // for getting notices
  errorMessage?: string; // when data fails
  panelId: number; //for opening inspector
}

export function PanelHeaderState(props: Props) {
  const { data, errorMessage, panelId } = props;
  const state = getGeneralPanelState(data, errorMessage);
  const styles = useStyles2(getStyles);
  const mode = getInfoMode(state);
  const iconName = getInfoMode(state) === InfoMode.Info ? 'info-circle' : 'exclamation-triangle';

  const openInspect = useCallback(
    (e: React.SyntheticEvent, tab: string) => {
      e.stopPropagation();
      locationService.partial({ inspect: panelId, inspectTab: tab });
    },
    [panelId]
  );
  let variantType: ToolbarButtonVariant = 'default';
  if (!mode) {
    return null;
  }

  variantType = getVariantType(mode);
  const tooltipMessage = InfoMode.Error && errorMessage;
  const onClick = mode === InfoMode.Info ? undefined : (e: React.SyntheticEvent) => openInspect(e, InspectTab.Error);

  return (
    <div className={styles.container}>
      <ToolbarButton
        onClick={onClick}
        variant={variantType}
        className={styles.buttonStyles}
        icon={iconName}
        tooltip={tooltipMessage}
      />
    </div>
  );
}

function getVariantType(mode: InfoMode) {
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
  return variantType;
}

function getGeneralPanelState(data: PanelData | undefined, errorMessage: string | undefined) {
  let state;
  if (errorMessage) {
    state = InfoMode.Error;
  } else if (data?.state === LoadingState.Warning) {
    state = InfoMode.Warning;
  } else {
    state = '';
  }
  return state;
}

const getInfoMode = (state: string) => {
  switch (state) {
    case 'Error':
      return InfoMode.Error;
    case 'Info':
      return InfoMode.Info;
    case 'Warning':
      return InfoMode.Warning;
    default:
      return undefined;
  }
};

const getStyles = (theme: GrafanaTheme2) => {
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
    containerMultipleStates: css({
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(1),
      width: '100%',
    }),
  };
};
