import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme, LoadingState } from '@grafana/data';
import { Icon, Tooltip, useStyles } from '@grafana/ui';

interface Props {
  state: LoadingState;
  onClick: () => void;
}

export const PanelHeaderLoadingIndicator: FC<Props> = ({ state, onClick }) => {
  const styles = useStyles(getStyles);

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

function getStyles(theme: GrafanaTheme) {
  return {
    streamIndicator: css`
      width: 10px;
      height: 10px;
      background: ${theme.colors.textFaint};
      box-shadow: 0 0 2px ${theme.colors.textFaint};
      border-radius: 50%;
      position: relative;
      top: 6px;
      right: 1px;
    `,
  };
}
