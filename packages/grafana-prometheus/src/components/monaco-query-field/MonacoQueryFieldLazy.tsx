import React, { Suspense } from 'react';

import MonacoQueryField from './MonacoQueryField';
import { Props } from './MonacoQueryFieldProps';

// const Field = React.lazy(() => import('./MonacoQueryField'));

export const MonacoQueryFieldLazy = (props: Props) => {
  return (
    <Suspense fallback={null}>
      <MonacoQueryField {...props} />
    </Suspense>
  );
};
