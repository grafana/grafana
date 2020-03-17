import React, { FC } from 'react';
import { e2e } from '@grafana/e2e';

interface Props {
  results: any;
  onSelectionChanged: any;
  onTagSelected: any;
  onFolderExpanding: any;
  editable: boolean;
  selectors: typeof e2e.pages.Dashboards.selectors;
}

export const SearchResults: FC<Props> = props => {
  return <div>Search results</div>;
};
