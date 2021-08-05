import React from 'react';
import { cx } from '@emotion/css';

export interface SectionLabelProps {
  name: string;
  className?: string;
}

/**
 * @alpha
 */
export const SectionLabel = ({ name, className }: SectionLabelProps) => (
  <label className={cx('gf-form-label query-keyword', className)}>{name}</label>
);
