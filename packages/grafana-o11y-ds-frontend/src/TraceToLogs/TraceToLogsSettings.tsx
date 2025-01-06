import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';
import * as React from 'react';

import { DataSourceJsonData, DataSourceInstanceSettings, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigDescriptionLink, ConfigSection } from '@grafana/experimental';
import { DataSourcePicker } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input, InlineSwitch } from '@grafana/ui';

import { IntervalInput } from '../IntervalInput/IntervalInput';

import { TagMappingInput } from './TagMappingInput';

export interface TraceToLogsTag {
  key: string;
  value?: string;
}

// @deprecated use getTraceToLogsOptions to get the v2 version of this config from jsonData
export interface TraceToLogsOptions {
  datasourceUid?: string;
  tags?: string[];
  mappedTags?: TraceToLogsTag[];
  mapTagNamesEnabled?: boolean;
  spanStartTimeShift?: string;
  spanEndTimeShift?: string;
  filterByTraceID?: boolean;
  filterBySpanID?: boolean;
  lokiSearch?: boolean; // legacy
}

export interface TraceToLogsOptionsV2 {
  datasourceUid?: string;
  tags?: TraceToLogsTag[];
  spanStartTimeShift?: string;
  spanEndTimeShift?: string;
  filterByTraceID?: boolean;
  filterBySpanID?: boolean;
  query?: string;
  customQuery: boolean;
}

export interface TraceToLogsData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  tracesToLogsV2?: TraceToLogsOptionsV2;
}

/**
 * Gets new version of the traceToLogs config from the json data either returning directly or transforming the old
 * version to new and returning that.
 */
export function getTraceToLogsOptions(data?: TraceToLogsData): TraceToLogsOptionsV2 | undefined {
  if (data?.tracesToLogsV2) {
    return data.tracesToLogsV2;
  }
  if (!data?.tracesToLogs) {
    return undefined;
  }
  const traceToLogs: TraceToLogsOptionsV2 = {
    customQuery: false,
  };
  traceToLogs.datasourceUid = data.tracesToLogs.datasourceUid;
  traceToLogs.tags = data.tracesToLogs.mapTagNamesEnabled
    ? data.tracesToLogs.mappedTags
    : data.tracesToLogs.tags?.map((tag) => ({ key: tag }));
  traceToLogs.filterByTraceID = data.tracesToLogs.filterByTraceID;
  traceToLogs.filterBySpanID = data.tracesToLogs.filterBySpanID;
  traceToLogs.spanStartTimeShift = data.tracesToLogs.spanStartTimeShift;
  traceToLogs.spanEndTimeShift = data.tracesToLogs.spanEndTimeShift;
  return traceToLogs;
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {}

export function TraceToLogsSettings({ options, onOptionsChange }: Props) {
  const supportedDataSourceTypes = [
    'loki',
    'elasticsearch',
    'grafana-splunk-datasource', // external
    'grafana-opensearch-datasource', // external
    'grafana-falconlogscale-datasource', // external
    'googlecloud-logging-datasource', // external
  ];

  const traceToLogs = useMemo(
    (): TraceToLogsOptionsV2 => getTraceToLogsOptions(options.jsonData) || { customQuery: false },
    [options.jsonData]
  );
  const { query = '', tags, customQuery } = traceToLogs;

  const updateTracesToLogs = useCallback(
    (value: Partial<TraceToLogsOptionsV2>) => {
      // Cannot use updateDatasourcePluginJsonDataOption here as we need to update 2 keys, and they would overwrite each
      // other as updateDatasourcePluginJsonDataOption isn't synchronized
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          tracesToLogsV2: {
            ...traceToLogs,
            ...value,
          },
          tracesToLogs: undefined,
        },
      });
    },
    [onOptionsChange, options, traceToLogs]
  );

  return (
    <div className={css({ width: '100%' })}>
      <InlineFieldRow>
        <InlineField
          tooltip="The logs data source the trace is going to navigate to"
          label="Data source"
          labelWidth={26}
        >
          <DataSourcePicker
            inputId="trace-to-logs-data-source-picker"
            filter={(ds) => supportedDataSourceTypes.includes(ds.type)}
            current={traceToLogs.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds: DataSourceInstanceSettings) =>
              updateTracesToLogs({
                datasourceUid: ds.uid,
              })
            }
            onClear={() => updateTracesToLogs({ datasourceUid: undefined })}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <IntervalInput
          label={getTimeShiftLabel('start')}
          tooltip={getTimeShiftTooltip('start', '0')}
          value={traceToLogs.spanStartTimeShift || ''}
          onChange={(val) => {
            updateTracesToLogs({ spanStartTimeShift: val });
          }}
          isInvalidError={invalidTimeShiftError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <IntervalInput
          label={getTimeShiftLabel('end')}
          tooltip={getTimeShiftTooltip('end', '0')}
          value={traceToLogs.spanEndTimeShift || ''}
          onChange={(val) => {
            updateTracesToLogs({ spanEndTimeShift: val });
          }}
          isInvalidError={invalidTimeShiftError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          tooltip="Tags that will be used in the query. Default tags: 'cluster', 'hostname', 'namespace', 'pod', 'service.name', 'service.namespace'"
          label="Tags"
          labelWidth={26}
        >
          <TagMappingInput values={tags ?? []} onChange={(v) => updateTracesToLogs({ tags: v })} />
        </InlineField>
      </InlineFieldRow>

      <IdFilter
        disabled={customQuery}
        type={'trace'}
        id={'filterByTraceID'}
        value={Boolean(traceToLogs.filterByTraceID)}
        onChange={(val) => updateTracesToLogs({ filterByTraceID: val })}
      />
      <IdFilter
        disabled={customQuery}
        type={'span'}
        id={'filterBySpanID'}
        value={Boolean(traceToLogs.filterBySpanID)}
        onChange={(val) => updateTracesToLogs({ filterBySpanID: val })}
      />

      <InlineFieldRow>
        <InlineField
          tooltip="Use a custom query with the possibility to interpolate variables from the trace or span"
          label="Use custom query"
          labelWidth={26}
        >
          <InlineSwitch
            id={'customQuerySwitch'}
            value={customQuery}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              updateTracesToLogs({ customQuery: event.currentTarget.checked })
            }
          />
        </InlineField>
      </InlineFieldRow>

      {customQuery && (
        <InlineField
          label="Query"
          labelWidth={26}
          tooltip="The query that will run when navigating from a trace to logs data source. Interpolate tags using the `$__tags` keyword"
          grow
        >
          <Input
            label="Query"
            type="text"
            allowFullScreen
            value={query}
            onChange={(e) => updateTracesToLogs({ query: e.currentTarget.value })}
          />
        </InlineField>
      )}
    </div>
  );
}

interface IdFilterProps {
  type: 'trace' | 'span';
  id: string;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
}
function IdFilter(props: IdFilterProps) {
  return (
    <InlineFieldRow>
      <InlineField
        disabled={props.disabled}
        label={`Filter by ${props.type} ID`}
        labelWidth={26}
        grow
        tooltip={`Filters logs by ${props.type} ID, where the ${props.type} ID should be part of the log line`}
      >
        <InlineSwitch
          id={props.id}
          value={props.value}
          onChange={(event: React.SyntheticEvent<HTMLInputElement>) => props.onChange(event.currentTarget.checked)}
        />
      </InlineField>
    </InlineFieldRow>
  );
}

export const getTimeShiftLabel = (type: 'start' | 'end') => {
  return `Span ${type} time shift`;
};

export const getTimeShiftTooltip = (type: 'start' | 'end', defaultVal: string) => {
  return `Shifts the ${type} time of the span. Default: ${defaultVal} (Time units can be used here, for example: 5s, -1m, 3h)`;
};

export const invalidTimeShiftError = 'Invalid time shift. See tooltip for examples.';

export const TraceToLogsSection = ({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps) => {
  let suffix = options.type;
  suffix += options.type === 'tempo' ? '/configure-tempo-data-source/#trace-to-logs' : '/#trace-to-logs';

  return (
    <ConfigSection
      title="Trace to logs"
      description={
        <ConfigDescriptionLink
          description="Navigate from a trace span to the selected data source's logs."
          suffix={suffix}
          feature="trace to logs"
        />
      }
      isCollapsible={true}
      isInitiallyOpen={true}
    >
      <TraceToLogsSettings options={options} onOptionsChange={onOptionsChange} />
    </ConfigSection>
  );
};
