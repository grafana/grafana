import React, { useState } from 'react';

import { CoreApp, isValidDuration, SelectableValue } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/experimental';
import { config, reportInteraction } from '@grafana/runtime';
import { AutoSizeInput, RadioButtonGroup, Select } from '@grafana/ui';
import { QueryOptionGroup } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryOptionGroup';

import { preprocessMaxLines, queryTypeOptions, RESOLUTION_OPTIONS } from '../../components/LokiOptionFields';
import { LokiDatasource } from '../../datasource';
import { isLogsQuery } from '../../queryUtils';
import { LokiQuery, LokiQueryType, QueryStats } from '../../types';

export interface Props {
  query: LokiQuery;
  onChange: (update: LokiQuery) => void;
  onRunQuery: () => void;
  maxLines: number;
  app?: CoreApp;
  datasource: LokiDatasource;
  queryStats: QueryStats | undefined;
}

export const LokiQueryBuilderOptions = React.memo<Props>(
  ({ app, query, onChange, onRunQuery, maxLines, datasource, queryStats }) => {
    const [chunkRangeValid, setChunkRangeValid] = useState(true);

    const onQueryTypeChange = (value: LokiQueryType) => {
      onChange({ ...query, queryType: value });
      onRunQuery();
    };

    const onResolutionChange = (option: SelectableValue<number>) => {
      reportInteraction('grafana_loki_resolution_clicked', {
        app,
        resolution: option.value,
      });
      onChange({ ...query, resolution: option.value });
      onRunQuery();
    };

    const onChunkRangeChange = (evt: React.FormEvent<HTMLInputElement>) => {
      const value = evt.currentTarget.value;
      if (!isValidDuration(value)) {
        setChunkRangeValid(false);
        return;
      }
      setChunkRangeValid(true);
      onChange({ ...query, chunkDuration: value });
      onRunQuery();
    };

    const onLegendFormatChanged = (evt: React.FormEvent<HTMLInputElement>) => {
      onChange({ ...query, legendFormat: evt.currentTarget.value });
      onRunQuery();
    };

    function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
      const newMaxLines = preprocessMaxLines(e.currentTarget.value);
      if (query.maxLines !== newMaxLines) {
        onChange({ ...query, maxLines: newMaxLines });
        onRunQuery();
      }
    }

    let queryType = query.queryType ?? (query.instant ? LokiQueryType.Instant : LokiQueryType.Range);
    let showMaxLines = isLogsQuery(query.expr);

    return (
      <EditorRow>
        <QueryOptionGroup
          title="Options"
          collapsedInfo={getCollapsedInfo(query, queryType, showMaxLines, maxLines)}
          queryStats={queryStats}
        >
          <EditorField
            label="Legend"
            tooltip="Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname."
          >
            <AutoSizeInput
              placeholder="{{label}}"
              id="loki-query-editor-legend-format"
              type="string"
              minWidth={14}
              defaultValue={query.legendFormat}
              onCommitChange={onLegendFormatChanged}
            />
          </EditorField>
          <EditorField label="Type">
            <RadioButtonGroup options={queryTypeOptions} value={queryType} onChange={onQueryTypeChange} />
          </EditorField>
          {showMaxLines && (
            <EditorField label="Line limit" tooltip="Upper limit for number of log lines returned by query.">
              <AutoSizeInput
                className="width-4"
                placeholder={maxLines.toString()}
                type="number"
                min={0}
                defaultValue={query.maxLines?.toString() ?? ''}
                onCommitChange={onMaxLinesChange}
              />
            </EditorField>
          )}
          <EditorField label="Resolution">
            <Select
              isSearchable={false}
              onChange={onResolutionChange}
              options={RESOLUTION_OPTIONS}
              value={query.resolution || 1}
              aria-label="Select resolution"
            />
          </EditorField>
          {config.featureToggles.lokiQuerySplittingConfig && config.featureToggles.lokiQuerySplitting && (
            <EditorField
              label="Chunk Duration"
              tooltip="Defines the duration of a single query chunk when query chunking is used."
            >
              <AutoSizeInput
                minWidth={14}
                type="string"
                min={0}
                defaultValue={query.chunkDuration ?? '1d'}
                onCommitChange={onChunkRangeChange}
                invalid={!chunkRangeValid}
              />
            </EditorField>
          )}
        </QueryOptionGroup>
      </EditorRow>
    );
  }
);

function getCollapsedInfo(
  query: LokiQuery,
  queryType: LokiQueryType,
  showMaxLines: boolean,
  maxLines: number
): string[] {
  const queryTypeLabel = queryTypeOptions.find((x) => x.value === queryType);
  const resolutionLabel = RESOLUTION_OPTIONS.find((x) => x.value === (query.resolution ?? 1));

  const items: string[] = [];

  if (query.legendFormat) {
    items.push(`Legend: ${query.legendFormat}`);
  }

  if (query.resolution) {
    items.push(`Resolution: ${resolutionLabel?.label}`);
  }

  items.push(`Type: ${queryTypeLabel?.label}`);

  if (showMaxLines) {
    items.push(`Line limit: ${query.maxLines ?? maxLines}`);
  }

  return items;
}

LokiQueryBuilderOptions.displayName = 'LokiQueryBuilderOptions';
