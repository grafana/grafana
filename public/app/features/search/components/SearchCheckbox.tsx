import React, { memo } from 'react';

import { Checkbox } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  className?: string;
  editable?: boolean;
  'aria-label'?: string;
}

export const SearchCheckbox = memo(
  ({ onClick, className, checked = false, editable = false, 'aria-label': ariaLabel }: Props) => {
    return editable ? (
      <Checkbox onClick={onClick} className={className} value={checked} aria-label={ariaLabel} />
    ) : null;
  }
);

SearchCheckbox.displayName = 'SearchCheckbox';
