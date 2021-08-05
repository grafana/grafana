import React from 'react';
import { cx } from '@emotion/css';

type Props = {
  name: string;
  className?: string;
};

/**
 * @alpha
 */
export const SectionLabel = ({ name, className }: Props) => (
  <label className={cx('gf-form-label query-keyword', className)}>{name}</label>
);
