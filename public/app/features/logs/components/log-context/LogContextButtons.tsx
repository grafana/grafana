import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, InlineSwitch, useStyles2 } from '@grafana/ui';

export type Props = {
  wrapLines?: boolean;
  onChangeWrapLines: (wrapLines: boolean) => void;
  onScrollCenterClick: () => void;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    buttons: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
}

export const LogContextButtons = (props: Props) => {
  const styles = useStyles2(getStyles);
  const { wrapLines, onChangeWrapLines, onScrollCenterClick } = props;
  const internalOnChangeWrapLines = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const state = event.currentTarget.checked;
      reportInteraction('grafana_explore_logs_log_context_toggle_lines_clicked', {
        state,
      });
      onChangeWrapLines(state);
    },
    [onChangeWrapLines]
  );

  return (
    <div className={styles.buttons}>
      <InlineSwitch showLabel value={wrapLines} onChange={internalOnChangeWrapLines} label="Wrap lines" />
      <Button variant="secondary" onClick={onScrollCenterClick}>
        Center matched line
      </Button>
    </div>
  );
};
