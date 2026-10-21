import * as React from 'react';

import { textUtil } from '@grafana/data';
import { isHttpUrl } from 'app/core/utils/url';

export const renderValue = (value: string): string | React.ReactNode => {
  if (!isHttpUrl(value)) {
    return value;
  }

  return (
    <a href={textUtil.sanitizeUrl(value)} target={'_blank'} className="external-link" rel="noreferrer">
      {value}
    </a>
  );
};
