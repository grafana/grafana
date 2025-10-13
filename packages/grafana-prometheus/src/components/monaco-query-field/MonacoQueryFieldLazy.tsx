// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/MonacoQueryFieldLazy.tsx
import { Suspense } from 'react';

import MonacoQueryField from './MonacoQueryField';
import { Props } from './MonacoQueryFieldProps';

export const MonacoQueryFieldLazy = (props: Props) => {
  return (
    <Suspense fallback={null}>
      <MonacoQueryField {...props} />
    </Suspense>
  );
};
