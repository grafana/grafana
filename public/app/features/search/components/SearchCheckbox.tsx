import React, { FC, memo } from 'react';
import { Checkbox } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  className?: string;
  editable?: boolean;
}

export const SearchCheckbox: FC<Props> = memo(({ onClick, className, checked = false, editable = false }) => {
  return editable ? (
    <div onClick={onClick} className={className}>
      <Checkbox value={checked} />
    </div>
  ) : null;
});

SearchCheckbox.displayName = 'SearchCheckbox';
