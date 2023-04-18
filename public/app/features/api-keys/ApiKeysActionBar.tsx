import React from 'react';

import { FilterInput, InlineField } from '@grafana/ui';

interface Props {
  searchQuery: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
}

export const ApiKeysActionBar = ({ searchQuery, disabled, onSearchChange }: Props) => {
  return (
    <div className="page-action-bar">
      <InlineField grow="true">
        <FilterInput placeholder="Search keys" value={searchQuery} onChange={onSearchChange} />
      </InlineField>
    </div>
  );
};
