import { css } from '@emotion/css';
import React from 'react';

import { IconButton } from './IconButton';

interface Props {
  index: number;
  elements: any[];
  onAdd: () => void;
  onRemove: () => void;
}

/**
 * A component used to show add & remove buttons for mutable lists of values. Wether to show or not the add or the remove buttons
 * depends on the `index` and `elements` props. This enforces a consistent experience whenever this pattern is used.
 */
export const AddRemove = ({ index, onAdd, onRemove, elements }: Props) => {
  return (
    <div
      className={css`
        display: flex;
      `}
    >
      {index === 0 && <IconButton iconName="plus" onClick={onAdd} label="add" />}

      {elements.length >= 2 && <IconButton iconName="minus" onClick={onRemove} label="remove" />}
    </div>
  );
};
