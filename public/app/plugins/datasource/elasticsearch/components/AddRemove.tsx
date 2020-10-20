import { css } from 'emotion';
import React, { FunctionComponent } from 'react';
import { IconButton } from './IconButton';

interface Props {
  index: number;
  elements: any[];
  onAdd: () => void;
  onRemove: () => void;
}

export const AddRemove: FunctionComponent<Props> = ({ index, onAdd, onRemove, elements }) => {
  return (
    <div
      className={css`
        display: flex;
      `}
    >
      {index === 0 && <IconButton iconName="plus" onClick={onAdd} />}

      {elements.length >= 2 && <IconButton iconName="minus" onClick={onRemove} />}
    </div>
  );
};
