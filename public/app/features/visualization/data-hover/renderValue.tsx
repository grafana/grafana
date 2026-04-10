import { cx } from '@emotion/css';
import * as React from 'react';

import { textUtil } from '@grafana/data';

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const renderValue = (value: string): string | React.ReactNode => {
  if (!isHttpUrl(value)) {
    return value;
  }

  return (
    <a href={textUtil.sanitizeUrl(value)} target={'_blank'} className={cx('external-link')} rel="noreferrer">
      {value}
    </a>
  );
};
