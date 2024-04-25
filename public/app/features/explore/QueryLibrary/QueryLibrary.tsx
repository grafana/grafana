import React from 'react';

import { QueryLibraryApiProvider } from '@grafana/runtime';

import { QueryTemplatesList } from './QueryTemplatesList';

export function QueryLibrary() {
  return (
    <QueryLibraryApiProvider>
      <QueryTemplatesList />
    </QueryLibraryApiProvider>
  );
}
