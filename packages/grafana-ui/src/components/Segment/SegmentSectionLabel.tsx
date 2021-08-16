import React from 'react';
import { cx } from '@emotion/css';

/**
 * @alpha
 */
export const SegmentSectionLabel = ({ name, className }: { name: string; className?: string }) => (
  <label className={cx('gf-form-label query-keyword', className)}>{name}</label>
);
