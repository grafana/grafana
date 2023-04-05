import React from 'react';

import { parseRouteParams } from 'app/features/search/utils';

interface SearchViewProps {
  searchState: ReturnType<typeof parseRouteParams>;
}

export default function SearchView({ searchState }: SearchViewProps) {
  return (
    <div>
      <p>SearchView</p>

      <pre>{JSON.stringify(searchState, null, 2)}</pre>
    </div>
  );
}
