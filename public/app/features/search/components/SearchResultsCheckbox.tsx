import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { Forms } from '@grafana/ui';

interface CheckboxProps {
  checked: boolean;
  onClick: any;
  editable?: boolean;
}
export const SearchResultsCheckbox: FC<CheckboxProps> = ({ checked, onClick, editable = false }) => {
  return (
    editable && (
      <div
        onClick={onClick}
        className={cx(
          'center-vh',
          css`
            height: 19px;
            & > label {
              height: 100%;
            }
          `
        )}
      >
        <Forms.Checkbox value={checked} />
      </div>
    )
  );
};
