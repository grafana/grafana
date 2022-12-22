import React, { FC, memo } from 'react';

import { Checkbox } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  className?: string;
  editable?: boolean;
  'aria-label'?: string;
}

export const SearchCheckbox: FC<Props> = memo(
  ({ onClick, className, checked = false, editable = false, 'aria-label': ariaLabel }) => {
    return editable ? (
      <div onClick={onClick} className={className}>
        <Checkbox value={checked} aria-label={ariaLabel} />
      </div>
    ) : null;
  }
);

SearchCheckbox.displayName = 'SearchCheckbox';
