import React from 'react';

import { QueryLibraryApiProvider } from '@grafana/runtime/src/services/queryLibrary';

import { QueryTemplatesList } from './QueryTemplatesList';

export function QueryLibrary() {
  return (
    <QueryLibraryApiProvider>
      <QueryTemplatesList />
    </QueryLibraryApiProvider>
  );
}
