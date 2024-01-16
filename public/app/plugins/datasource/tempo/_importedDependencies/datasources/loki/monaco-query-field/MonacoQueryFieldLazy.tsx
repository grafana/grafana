import React, { Suspense } from 'react';

import { Props } from './MonacoQueryFieldProps';

const Field = React.lazy(() => import(/* webpackChunkName: "loki-query-field" */ './MonacoQueryField'));

export const MonacoQueryFieldLazy = (props: Props) => {
  return (
    <Suspense fallback={null}>
      <Field {...props} />
    </Suspense>
  );
};
