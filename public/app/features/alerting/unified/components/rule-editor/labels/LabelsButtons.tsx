import React from 'react';

import { Button } from '@grafana/ui';

interface RemoveButtonProps {
  remove: (index?: number | number[] | undefined) => void;
  className: string;
  index: number;
}
export function RemoveButton({ remove, className, index }: RemoveButtonProps) {
  return (
    <Button
      className={className}
      aria-label="delete label"
      icon="trash-alt"
      data-testid={`delete-label-${index}`}
      variant="secondary"
      onClick={() => {
        remove(index);
      }}
    />
  );
}

interface AddButtonProps {
  append: () => void;
  className: string;
}
export function AddButton({ append, className }: AddButtonProps) {
  return (
    <Button className={className} icon="plus-circle" type="button" variant="secondary" onClick={append}>
      Add label
    </Button>
  );
}
