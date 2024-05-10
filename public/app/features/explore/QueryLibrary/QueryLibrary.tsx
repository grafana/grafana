import React from 'react';

import { QueryLibraryApiProvider } from 'app/features/query-library';

import { QueryTemplatesList } from './QueryTemplatesList';

export function QueryLibrary() {
  return (
    <QueryLibraryApiProvider>
      <QueryTemplatesList />
    </QueryLibraryApiProvider>
  );
}
