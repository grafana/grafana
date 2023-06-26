import { cx } from '@emotion/css';
import React from 'react';

import { isUrl } from './utils';

export const renderValue = (value: string): string | React.ReactNode => {
  if (isUrl(value)) {
    return (
      <a href={value} target={'_blank'} className={cx('external-link')} rel="noreferrer">
        {value}
      </a>
    );
  }

  return value;
};
