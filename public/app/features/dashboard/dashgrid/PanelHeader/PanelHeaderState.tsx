import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

enum InfoMode {
  Error = 'Error',
  Warning = 'Warning',
}

interface Props {
  panelId: number;
  dataState: LoadingState;
  errorMessage?: string;
}

export function PanelHeaderState({ dataState, errorMessage, panelId }: Props) {
  const styles = useStyles2(getStyles);
  const [mode, setMode] = useState<InfoMode>();

  useEffect(() => {
    if (errorMessage) {
      setMode(InfoMode.Error);
    } else if (dataState === LoadingState.Warning) {
      setMode(InfoMode.Warning);
    } else {
      setMode(undefined);
    }
  }, [dataState, errorMessage]);

  const openInspect = useCallback(
    (e: React.SyntheticEvent, tab: string) => {
      e.stopPropagation();
      locationService.partial({ inspect: panelId, inspectTab: tab });
    },
    [panelId]
  );

  return mode ? (
    <div className={styles.container}>
      <ToolbarButton
        onClick={(e: React.SyntheticEvent) => openInspect(e, InspectTab.Error)}
        variant={getVariantType(mode)}
        className={styles.buttonStyles}
        icon="exclamation-triangle"
        tooltip={InfoMode.Error && errorMessage}
      />
    </div>
  ) : null;
}

function getVariantType(mode: InfoMode) {
  switch (mode) {
    case InfoMode.Error:
      return 'destructive';
    case InfoMode.Warning:
      return 'warning';
    default:
      return 'default';
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      label: 'panel-header-state',
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
