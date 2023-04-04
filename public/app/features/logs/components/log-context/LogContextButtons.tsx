import { css } from '@emotion/css';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { ButtonGroup, ButtonSelect, ToolbarButton, useStyles2 } from '@grafana/ui';

const getStyles = () => {
  return {
    logSamplesButton: css`
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
  onAddClick: () => void;
  onRemoveClick: () => void;
  position?: 'top' | 'bottom';
};

export const LogContextButtons = (props: Props) => {
  const { option, onChangeOption, onAddClick, onRemoveClick } = props;
  const styles = useStyles2(getStyles);

  return (
    <ButtonGroup className={styles.logSamplesButton}>
      <ToolbarButton aria-label="Add lines" variant="canvas" onClick={onAddClick} icon="plus" narrow />
      <ToolbarButton aria-label="Remove lines" variant="canvas" onClick={onRemoveClick} icon="minus" narrow />
      <ButtonSelect variant="canvas" value={option} options={LoadMoreOptions} onChange={onChangeOption} />
    </ButtonGroup>
  );
};
