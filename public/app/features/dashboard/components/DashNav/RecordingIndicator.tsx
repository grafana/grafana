import React, { ReactElement } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

export interface RecordingIndicatorProps {
  onClick: () => void;
}

export function RecordingIndicator({ onClick }: RecordingIndicatorProps): ReactElement {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.noBorderContainer}>
      <IconButton
        name="circle"
        className={styles.recording}
        size="sm"
        iconType="mono"
        onClick={onClick}
        tooltip="Stop the recording"
        tooltipPlacement="bottom"
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noBorderContainer: css`
      padding: 0 ${theme.spacing(1)};
      display: flex;
    `,
    recording: css`
      color: ${theme.colors.error.text};
      animation: pulse 1s cubic-bezier(1, 0.1, 0.73, 1) 0s infinite alternate;
      @keyframes pulse {
        100% {
          transform: scale(1.2);
        }
      }
    `,
  };
}
