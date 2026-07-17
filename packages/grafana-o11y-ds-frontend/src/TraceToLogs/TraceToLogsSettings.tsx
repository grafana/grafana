import { css } from '@emotion/css';
import { useCallback, useMemo, useRef } from 'react';
import * as React from 'react';

import {
  type DataSourceJsonData,
  type DataSourceInstanceSettings,
  type DataSourcePluginOptionsEditorProps,
  type GrafanaTheme2,
} from '@grafana/data';
import { ConfigDescriptionLink, ConfigSection } from '@grafana/plugin-ui';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, Input, InlineSwitch, useStyles2 } from '@grafana/ui';

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
  name?: string;
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
  tracesToLogsV3?: TraceToLogsOptionsV2[];
}

/**
 * Gets new version of the traceToLogs config from the json data either returning directly or transforming the old
 * version to new and returning that.
 */
export function getTraceToLogsOptions(data?: TraceToLogsData): TraceToLogsOptionsV2 | undefined {
  if (data?.tracesToLogsV3?.length) {
    return data.tracesToLogsV3[0];
  }
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

export function getTracesToLogsOptions(data?: TraceToLogsData): TraceToLogsOptionsV2[] {
  if (data?.tracesToLogsV3?.length) {
    return data.tracesToLogsV3;
  }

  const traceToLogs = getTraceToLogsOptions(data);
  return traceToLogs ? [traceToLogs] : [];
}

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {}

export function TraceToLogsSettings({ options, onOptionsChange }: Props) {
  const styles = useStyles2(getStyles);
  const supportedDataSourceTypes = [
    'loki',
    'elasticsearch',
    'grafana-splunk-datasource', // external
    'grafana-opensearch-datasource', // external
    'grafana-falconlogscale-datasource', // external
    'googlecloud-logging-datasource', // external
    'victoriametrics-logs-datasource', // external
  ];

  const tracesToLogs = useMemo(() => getTracesToLogsOptions(options.jsonData), [options.jsonData]);
  const nextDestinationId = useRef(0);
  const createDestinationId = useCallback(() => String(nextDestinationId.current++), []);
  const destinationIds = useRef(tracesToLogs.map(createDestinationId));

  const updateTracesToLogs = useCallback(
    (value: TraceToLogsOptionsV2[]) => {
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          tracesToLogsV3: value,
          tracesToLogs: undefined,
          // Older Grafana versions can continue using the first configured destination.
          tracesToLogsV2: value[0],
        },
      });
    },
    [onOptionsChange, options]
  );

  const updateLink = useCallback(
    (index: number, value: Partial<TraceToLogsOptionsV2>) => {
      const updated = tracesToLogs.map((link, linkIndex) => (linkIndex === index ? { ...link, ...value } : link));
      updateTracesToLogs(updated);
    },
    [tracesToLogs, updateTracesToLogs]
  );

  const addDestination = useCallback(() => {
    destinationIds.current.push(createDestinationId());
    updateTracesToLogs([...tracesToLogs, { customQuery: false }]);
  }, [createDestinationId, tracesToLogs, updateTracesToLogs]);

  const removeDestination = useCallback(
    (index: number) => {
      destinationIds.current = destinationIds.current.filter((_, destinationIndex) => destinationIndex !== index);
      updateTracesToLogs(tracesToLogs.filter((_, destinationIndex) => destinationIndex !== index));
    },
    [tracesToLogs, updateTracesToLogs]
  );

  return (
    <div className={styles.wrapper}>
      {tracesToLogs.map((traceToLogs, index) => (
        <div
          key={destinationIds.current[index]}
          className={styles.destination}
          role="group"
          aria-label={traceToLogs.name || `Logs destination ${index + 1}`}
        >
          <InlineFieldRow>
            <InlineField
              tooltip="Label shown for this destination in the trace view"
              label="Link label"
              labelWidth={26}
            >
              <Input
                aria-label={`Link ${index + 1} label`}
                value={traceToLogs.name ?? ''}
                width={40}
                placeholder={`Logs destination ${index + 1}`}
                onChange={(event) => updateLink(index, { name: event.currentTarget.value })}
              />
            </InlineField>
          </InlineFieldRow>

          <TraceToLogsLinkSettings
            index={index}
            traceToLogs={traceToLogs}
            supportedDataSourceTypes={supportedDataSourceTypes}
            onChange={(value) => updateLink(index, value)}
          />

          <Button
            variant="destructive"
            fill="text"
            icon="trash-alt"
            type="button"
            aria-label={`Remove destination ${index + 1}`}
            onClick={() => removeDestination(index)}
          >
            Remove destination
          </Button>
        </div>
      ))}

      <Button variant="secondary" icon="plus" type="button" onClick={addDestination}>
        Add logs destination
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    width: '100%',
  }),
  destination: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
  }),
});

interface TraceToLogsLinkSettingsProps {
  index: number;
  traceToLogs: TraceToLogsOptionsV2;
  supportedDataSourceTypes: string[];
  onChange: (value: Partial<TraceToLogsOptionsV2>) => void;
}

function TraceToLogsLinkSettings({
  index,
  traceToLogs,
  supportedDataSourceTypes,
  onChange,
}: TraceToLogsLinkSettingsProps) {
  const { query = '', tags, customQuery } = traceToLogs;

  return (
    <>
      <InlineFieldRow>
        <InlineField
          tooltip="The logs data source the trace is going to navigate to"
          label="Data source"
          labelWidth={26}
        >
          <DataSourcePicker
            inputId={`trace-to-logs-data-source-picker-${index}`}
            filter={(ds) => supportedDataSourceTypes.includes(ds.type)}
            current={traceToLogs.datasourceUid}
            noDefault={true}
            width={40}
            onChange={(ds: DataSourceInstanceSettings) =>
              onChange({
                datasourceUid: ds.uid,
              })
            }
            onClear={() => onChange({ datasourceUid: undefined })}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <IntervalInput
          label={getTimeShiftLabel('start')}
          ariaLabel={`${getTimeShiftLabel('start')} for ${traceToLogs.name || `logs destination ${index + 1}`}`}
          tooltip={getTimeShiftTooltip('start', '0')}
          value={traceToLogs.spanStartTimeShift || ''}
          onChange={(val) => {
            onChange({ spanStartTimeShift: val });
          }}
          isInvalidError={invalidTimeShiftError}
        />
      </InlineFieldRow>

      <InlineFieldRow>
        <IntervalInput
          label={getTimeShiftLabel('end')}
          ariaLabel={`${getTimeShiftLabel('end')} for ${traceToLogs.name || `logs destination ${index + 1}`}`}
          tooltip={getTimeShiftTooltip('end', '0')}
          value={traceToLogs.spanEndTimeShift || ''}
          onChange={(val) => {
            onChange({ spanEndTimeShift: val });
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
          <TagMappingInput values={tags ?? []} onChange={(v) => onChange({ tags: v })} />
        </InlineField>
      </InlineFieldRow>

      <IdFilter
        disabled={customQuery}
        type={'trace'}
        id={`filterByTraceID-${index}`}
        value={Boolean(traceToLogs.filterByTraceID)}
        onChange={(val) => onChange({ filterByTraceID: val })}
      />
      <IdFilter
        disabled={customQuery}
        type={'span'}
        id={`filterBySpanID-${index}`}
        value={Boolean(traceToLogs.filterBySpanID)}
        onChange={(val) => onChange({ filterBySpanID: val })}
      />

      <InlineFieldRow>
        <InlineField
          tooltip="Use a custom query with the possibility to interpolate variables from the trace or span"
          label="Use custom query"
          labelWidth={26}
        >
          <InlineSwitch
            id={`customQuerySwitch-${index}`}
            value={customQuery}
            onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
              onChange({ customQuery: event.currentTarget.checked })
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
            onChange={(e) => onChange({ query: e.currentTarget.value })}
          />
        </InlineField>
      )}
    </>
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
