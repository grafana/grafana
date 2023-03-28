import React, { FC } from 'react';

import { Button, FilterInput } from '@grafana/ui';

interface Props {
  searchQuery: string;
  disabled: boolean;
  onAddClick: () => void;
  onSearchChange: (value: string) => void;
}

export const ApiKeysActionBar: FC<Props> = ({ searchQuery, disabled, onAddClick, onSearchChange }) => {
  return (
    <div className="page-action-bar">
      <div className="gf-form gf-form--grow">
        <FilterInput placeholder="Search keys" value={searchQuery} onChange={onSearchChange} />
      </div>
      <Button className="pull-right" onClick={onAddClick} disabled={disabled}>
        Add API key
      </Button>
    </div>
  );
};
