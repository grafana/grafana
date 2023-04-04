import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  state: LoadingState;
  onClick: () => void;
}

export const PanelHeaderLoadingIndicator = ({ state, onClick }: Props) => {
  const styles = useStyles2(getStyles);

  if (state === LoadingState.Loading) {
    return (
      <div className="panel-loading" onClick={onClick}>
        <Tooltip content="Cancel query">
          <Icon className="panel-loading__spinner spin-clockwise" name="sync" />
        </Tooltip>
      </div>
    );
  }

  if (state === LoadingState.Streaming) {
    return (
      <div className="panel-loading" onClick={onClick}>
        <div title="Streaming (click to stop)" className={styles.streamIndicator} />
      </div>
    );
  }

  return null;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    streamIndicator: css`
      width: 10px;
      height: 10px;
      background: ${theme.colors.text.disabled};
      box-shadow: 0 0 2px ${theme.colors.text.disabled};
      border-radius: 50%;
      position: relative;
      top: 6px;
      right: 1px;
    `,
  };
}
