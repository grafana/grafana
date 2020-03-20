import React, { FC } from 'react';
import { css } from 'emotion';
import { Forms } from '@grafana/ui';

interface Props {
  checked: boolean;
  onClick: any;
  editable?: boolean;
}

export const SearchCheckbox: FC<Props> = ({ checked, onClick, editable = false }) => {
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
  // Vertically align absolutely positioned checkbox element
  wrapper: css`
    height: 19px;
    & > label {
      height: 100%;
    }
  `,
});
