import { Icon } from '@grafana/ui';
import React, { FunctionComponent } from 'react';

interface Props {
  index: number;
  elements: any[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const AddRemove: FunctionComponent<Props> = ({ index, onAdd, onRemove, elements }) => {
  return (
    <>
      {index === 0 && (
        <button className="gf-form-label gf-form-label--btn query-part" onClick={onAdd}>
          <Icon name="plus" />
        </button>
      )}
      {elements.length >= 2 && (
        <button className="gf-form-label gf-form-label--btn query-part" onClick={() => onRemove(index)}>
          <Icon name="minus" />
        </button>
      )}
    </>
  );
};
