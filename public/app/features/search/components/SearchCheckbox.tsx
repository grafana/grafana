import React, { FC } from 'react';
import { css } from 'emotion';
import { Forms } from '@grafana/ui';

interface CheckboxProps {
  checked: boolean;
  onClick: any;
  editable?: boolean;
}

export const SearchCheckbox: FC<CheckboxProps> = ({ checked, onClick, editable = false }) => {
  const styles = getStyles();
  return (
    editable && (
      <div onClick={onClick} className={styles.wrapper}>
        <Forms.Checkbox value={checked} />
      </div>
    )
  );
};

const getStyles = () => ({
  wrapper: css`
    height: 19px;
    & > label {
      height: 100%;
    }
  `,
});
