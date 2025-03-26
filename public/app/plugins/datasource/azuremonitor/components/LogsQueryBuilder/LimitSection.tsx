import { useState } from 'react';

import { EditorRow, EditorFieldGroup, EditorField } from '@grafana/plugin-ui';
import { Input } from '@grafana/ui';

import { AzureLogAnalyticsMetadataColumn, AzureMonitorQuery } from '../../types';

import { buildAndUpdateQuery } from './utils';

interface LimitSectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  onQueryUpdate: (newQuery: AzureMonitorQuery) => void;
}

export const LimitSection: React.FC<LimitSectionProps> = (props) => {
  const { query, allColumns, onQueryUpdate } = props;
  const [limit, setLimit] = useState<number>();

  const handleQueryLimitUpdate = (newLimit: number) => {
    buildAndUpdateQuery({
      query,
      onQueryUpdate,
      allColumns,
      limit: newLimit,
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Limit" optional={true} tooltip={`Restrict the number of rows returned (default is 1000).`}>
          <Input
            className="width-5"
            type="number"
            placeholder="Enter limit"
            value={limit ?? 1000}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newValue = e.target.value.replace(/[^0-9]/g, '');
              setLimit(newValue ? Number(newValue) : undefined);
              handleQueryLimitUpdate(Number(newValue));
            }}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
