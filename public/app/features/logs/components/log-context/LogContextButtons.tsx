import React, { useCallback } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { InlineSwitch } from '@grafana/ui';

export type Props = {
  wrapLines?: boolean;
  onChangeWrapLines: (wrapLines: boolean) => void;
};

export const LogContextButtons = (props: Props) => {
  const { wrapLines, onChangeWrapLines } = props;
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

  return <InlineSwitch showLabel value={wrapLines} onChange={internalOnChangeWrapLines} label="Wrap lines" />;
};
