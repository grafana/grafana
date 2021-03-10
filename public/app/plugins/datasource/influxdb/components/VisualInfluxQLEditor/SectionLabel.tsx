import React from 'react';
import { css } from '@emotion/css';
import cx from 'classnames';

type Props = {
  name: string;
  isInitial?: boolean;
};

const uppercaseClass = css({
  textTransform: 'uppercase',
});

export const SectionLabel = ({ name, isInitial }: Props) => (
  <label className={cx('gf-form-label query-keyword', { 'width-7': isInitial ?? false }, uppercaseClass)}>{name}</label>
);
