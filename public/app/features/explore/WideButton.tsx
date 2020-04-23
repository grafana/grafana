import React from 'react';
import memoizeOne from 'memoize-one';
import { css, cx } from 'emotion';

const getStyles = memoizeOne(() => {
  return {
    buttonStyle: css`
      width: 100%;
      justify-content: center;
      margin: 0.5rem 0;
    `,
  };
});

type Props = {
  btnLabel: string;
  onBtnClick: () => void;
};

export const WideButton = (props: Props) => {
  const { btnLabel, onBtnClick } = props;
  const styles = getStyles();

  return (
    <button className={cx('gf-form-label', 'gf-form-label--btn', styles.buttonStyle)} onClick={onBtnClick}>
      {btnLabel}
    </button>
  );
};
