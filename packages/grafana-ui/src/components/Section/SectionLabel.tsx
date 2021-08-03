import React from 'react';
import { cx } from '@emotion/css';

type Props = {
  name: string;
  inline?: boolean;
};

/**
 * @alpha
 */
export const SectionLabel = ({ name, inline = false }: Props) => (
  <label className={cx('gf-form-label query-keyword', { 'width-7': !inline ?? false })}>{name}</label>
);
