import React from 'react';
import { cx, css } from '@emotion/css';

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
