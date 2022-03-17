import React from 'react';
import { EditorRow, EditorField } from '@grafana/experimental';
import { CoreApp, SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { LokiQuery, LokiQueryType } from '../../types';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';
import { queryTypeOptions, RESOLUTION_OPTIONS } from '../../components/LokiOptionFields';
import { getLegendModeLabel } from 'app/plugins/datasource/prometheus/querybuilder/components/PromQueryLegendEditor';

export interface Props {
  query: LokiQuery;
  onChange: (update: LokiQuery) => void;
  onRunQuery: () => void;
}

export const LokiQueryBuilderOptions = React.memo<Props>(({ query, onChange, onRunQuery }) => {
  const onQueryTypeChange = (value: LokiQueryType) => {
    onChange({ ...query, queryType: value });
    onRunQuery();
  };

  const onResolutionChange = (option: SelectableValue<number>) => {
    const nextQuery = { ...query, resolution: option.value };
    onChange(nextQuery);
  };

  let queryType = query.queryType ?? (query.instant ? LokiQueryType.Instant : LokiQueryType.Range);

  return (
    <EditorRow>
      <QueryOptionGroup title="Options" collapsedInfo={getCollapsedInfo(query, queryType)}>
        <EditorField label="Type">
          <RadioButtonGroup
            id="options.query.type"
            options={queryTypeOptions}
            value={queryType}
            onChange={onQueryTypeChange}
          />
        </EditorField>
        <EditorField label="Resolution">
          <Select
            isSearchable={false}
            onChange={onResolutionChange}
            options={RESOLUTION_OPTIONS}
            value={query.resolution}
            aria-label="Select resolution"
            menuShouldPortal
          />
        </EditorField>
      </QueryOptionGroup>
    </EditorRow>
  );
});

function getCollapsedInfo(query: LokiQuery, queryType: LokiQueryType): string[] {
  const queryTypeLabel = queryTypeOptions.find((x) => x.value === queryType);

  const items: string[] = [];

  items.push(`Legend: ${getLegendModeLabel(query.legendFormat)}`);

  if (query.resolution) {
    items.push(`Resolution: ${query.resolution}`);
  }

  items.push(`Type: ${queryTypeLabel?.value}`);

  return items;
}

LokiQueryBuilderOptions.displayName = 'LokiQueryBuilderOptions';
