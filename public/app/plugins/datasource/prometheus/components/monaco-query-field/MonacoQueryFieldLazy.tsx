import React, { Suspense } from 'react';

import { PromQuery } from '../../types';

import { Props } from './MonacoQueryFieldProps';

interface MonacoQueryFieldLazyProps extends Props {
  queries?: PromQuery[];
  query: PromQuery;
}

const Field = React.lazy(() => import(/* webpackChunkName: "prom-query-field" */ './MonacoQueryField'));

export const MonacoQueryFieldLazy = (props: MonacoQueryFieldLazyProps) => {
  return (
    <Suspense fallback={null}>
      <Field {...props} />
    </Suspense>
  );
};
