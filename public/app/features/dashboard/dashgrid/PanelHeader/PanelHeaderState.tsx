import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';

enum InfoMode {
  Error = 'Error',
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
    <ToolbarButton
      onClick={(e: React.SyntheticEvent) => openInspect(e, InspectTab.Error)}
      variant={getVariantType(mode)}
      className={styles.buttonStyles}
      icon="exclamation-triangle"
      tooltip={InfoMode.Error && errorMessage}
    />
  ) : null;
}

function getVariantType(mode: InfoMode) {
  switch (mode) {
    case InfoMode.Error:
      return 'destructive';
    default:
      return 'default';
  }
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
