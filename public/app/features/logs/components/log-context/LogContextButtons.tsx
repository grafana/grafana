import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ButtonGroup, ButtonSelect, InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';

const getStyles = () => {
  return {
    buttonGroup: css`
      display: inline-flex;
    `,
  };
};

export const LoadMoreOptions: Array<SelectableValue<number>> = [
  { label: '10 lines', value: 10 },
  { label: '20 lines', value: 20 },
  { label: '50 lines', value: 50 },
  { label: '100 lines', value: 100 },
  { label: '200 lines', value: 200 },
];

export type Props = {
  option: SelectableValue<number>;
  onChangeOption: (item: SelectableValue<number>) => void;
  position?: 'top' | 'bottom';

  wrapLines?: boolean;
  onChangeWrapLines?: (wrapLines: boolean) => void;
};

export const LogContextButtons = (props: Props) => {
  const { option, onChangeOption, wrapLines, onChangeWrapLines, position } = props;
  const internalOnChangeWrapLines = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      if (onChangeWrapLines) {
        const state = event.currentTarget.checked;
        reportInteraction('grafana_explore_logs_log_context_toggle_lines_clicked', {
          state,
        });
        onChangeWrapLines(state);
      }
    },
    [onChangeWrapLines]
  );
  const styles = useStyles2(getStyles);

  return (
    <ButtonGroup className={styles.buttonGroup}>
      {position === 'top' && onChangeWrapLines && (
        <InlineFieldRow>
          <InlineField label="Wrap lines">
            <InlineSwitch value={wrapLines} onChange={internalOnChangeWrapLines} />
          </InlineField>
        </InlineFieldRow>
      )}
      <ButtonSelect variant="canvas" value={option} options={LoadMoreOptions} onChange={onChangeOption} />
    </ButtonGroup>
  );
};
