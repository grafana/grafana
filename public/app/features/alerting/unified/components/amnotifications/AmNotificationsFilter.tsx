import React, { FormEvent } from 'react';
import { Label, Tooltip, Input, Icon } from '@grafana/ui';

interface Props {
  onFilterChange: (filterString: string) => void;
}

export const AmNotificationsFilter = (props: Props) => {
  const handleSearchChange = (e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    props.onFilterChange(target.value);
  };
  return (
    <div>
      <Label>
        <Tooltip
          content={
            <div>
              Filter rules and alerts using label querying, ex:
              <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
            </div>
          }
        >
          <Icon name="info-circle" />
        </Tooltip>
        Search by label
      </Label>
      <Input placeholder="Search" onChange={handleSearchChange} data-testid="search-query-input" />
    </div>
  );
};
