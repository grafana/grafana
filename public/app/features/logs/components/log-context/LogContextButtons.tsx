import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { ButtonGroup, InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';

const getStyles = () => {
  return {
    buttonGroup: css`
      display: inline-flex;
    `,
  };
};

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
  const styles = useStyles2(getStyles);

  return (
    <ButtonGroup className={styles.buttonGroup}>
      <InlineFieldRow>
        <InlineField label="Wrap lines">
          <InlineSwitch value={wrapLines} onChange={internalOnChangeWrapLines} />
        </InlineField>
      </InlineFieldRow>
    </ButtonGroup>
  );
};
