import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
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
  /** Label of this destination's link in the trace view. */
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
  /**
   * Logs destinations after the first one. The first destination stays in tracesToLogsV2, so Grafana versions and
   * plugin editors that only support a single destination keep reading and editing it.
   */
  tracesToLogsAdditional?: TraceToLogsOptionsV2[];
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

/**
 * Gets every configured trace-to-logs destination, in the order the trace view shows them.
 */
export function getTraceToLogsDestinations(data?: TraceToLogsData): TraceToLogsOptionsV2[] {
  const first = getTraceToLogsOptions(data);
  // Additional destinations still count without a first one: provisioning and the API accept any jsonData shape, and
  // hiding them would make the next editor change drop them. The shape guards keep malformed config from crashing.
  const additional = Array.isArray(data?.tracesToLogsAdditional) ? data.tracesToLogsAdditional : [];

  return [first, ...additional].filter(
    (destination): destination is TraceToLogsOptionsV2 =>
      destination !== null && typeof destination === 'object' && !Array.isArray(destination)
  );
}

let destinationKeyCounter = 0;
const newDestinationKey = () => `trace-to-logs-destination-${destinationKeyCounter++}`;

interface Props extends DataSourcePluginOptionsEditorProps<TraceToLogsData> {
  /**
   * Shows the link label and lets users add more logs destinations. Off by default: older Grafana versions only show
   * the first destination in the trace view, so a data source should only turn it on for Grafana versions that show all.
   */
  allowMultipleDestinations?: boolean;
}

export function TraceToLogsSettings({ options, onOptionsChange, allowMultipleDestinations = false }: Props) {
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

  const destinations = useMemo((): TraceToLogsOptionsV2[] => {
    if (!allowMultipleDestinations) {
      return [getTraceToLogsOptions(options.jsonData) ?? { customQuery: false }];
    }
    const configured = getTraceToLogsDestinations(options.jsonData);
    // A data source without trace to logs still shows one empty destination to fill in.
    return configured.length ? configured : [{ customQuery: false }];
  }, [options.jsonData, allowMultipleDestinations]);

  // Inputs such as the tag editor keep what is being edited in local state. Stable keys keep that state with its own
  // destination when an earlier destination is removed, instead of handing it to the one that moves into its place.
  const [destinationKeys, setDestinationKeys] = useState(() => destinations.map(newDestinationKey));
  let keys = destinationKeys.slice(0, destinations.length);
  if (keys.length < destinations.length) {
    keys = [...keys, ...destinations.slice(keys.length).map(newDestinationKey)];
    setDestinationKeys(keys);
  }

  const updateDestinations = useCallback(
    (value: TraceToLogsOptionsV2[]) => {
      // Cannot use updateDatasourcePluginJsonDataOption here as we need to update several keys, and they would
      // overwrite each other as updateDatasourcePluginJsonDataOption isn't synchronized
      onOptionsChange({
        ...options,
        jsonData: {
          ...options.jsonData,
          tracesToLogsV2: value[0],
          // Without the opt-in only the first destination is editable, so provisioned additional ones stay as they are.
          ...(allowMultipleDestinations && {
            tracesToLogsAdditional: value.length > 1 ? value.slice(1) : undefined,
          }),
          tracesToLogs: undefined,
        },
      });
    },
    [onOptionsChange, options, allowMultipleDestinations]
  );

  const updateDestination = (index: number, value: Partial<TraceToLogsOptionsV2>) => {
    updateDestinations(
      destinations.map((destination, destinationIndex) =>
        destinationIndex === index ? { ...destination, ...value } : destination
      )
    );
  };

  const addDestination = () => {
    setDestinationKeys([...keys, newDestinationKey()]);
    updateDestinations([...destinations, { customQuery: false }]);
  };

  const removeDestination = (index: number) => {
    setDestinationKeys(keys.filter((_, keyIndex) => keyIndex !== index));
    updateDestinations(destinations.filter((_, destinationIndex) => destinationIndex !== index));
  };

  const hasMultipleDestinations = destinations.length > 1;

  return (
    <div className={styles.wrapper}>
      {destinations.map((destination, index) => (
        <div
          key={keys[index]}
          className={hasMultipleDestinations ? styles.destination : undefined}
          role={allowMultipleDestinations ? 'group' : undefined}
          aria-label={allowMultipleDestinations ? destination.name || `Logs destination ${index + 1}` : undefined}
        >
          <TraceToLogsDestinationSettings
            index={index}
            traceToLogs={destination}
            showLinkLabel={allowMultipleDestinations}
            hasMultipleDestinations={hasMultipleDestinations}
            supportedDataSourceTypes={supportedDataSourceTypes}
            updateTracesToLogs={(value) => updateDestination(index, value)}
          />
          {hasMultipleDestinations && (
            <Button
              variant="secondary"
              size="sm"
              icon="trash-alt"
              type="button"
              aria-label={`Remove destination ${index + 1}`}
              onClick={() => removeDestination(index)}
            >
              Remove destination
            </Button>
          )}
        </div>
      ))}

      {allowMultipleDestinations && (
        <Button variant="secondary" icon="plus" type="button" onClick={addDestination}>
          Add logs destination
        </Button>
      )}
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

interface TraceToLogsDestinationSettingsProps {
  index: number;
  traceToLogs: TraceToLogsOptionsV2;
  showLinkLabel: boolean;
  hasMultipleDestinations: boolean;
  supportedDataSourceTypes: string[];
  updateTracesToLogs: (value: Partial<TraceToLogsOptionsV2>) => void;
}

function TraceToLogsDestinationSettings({
  index,
  traceToLogs,
  showLinkLabel,
  hasMultipleDestinations,
  supportedDataSourceTypes,
  updateTracesToLogs,
}: TraceToLogsDestinationSettingsProps) {
  const { query = '', tags, customQuery } = traceToLogs;
  // The first destination keeps the ids it had before multiple destinations, so existing selectors keep working.
  const idSuffix = index === 0 ? '' : `-${index}`;
  // Every destination repeats the same field labels, so time shift inputs need a destination-specific name.
  const destinationLabel = traceToLogs.name || `logs destination ${index + 1}`;

  return (
    <>
      {showLinkLabel && (
        <InlineFieldRow>
          <InlineField
            tooltip="Label of this destination's link in the trace view. When more than one destination is configured, the logs data source name is used if empty."
            label="Link label"
            labelWidth={26}
          >
            <Input
              id={`trace-to-logs-link-label${idSuffix}`}
              value={traceToLogs.name ?? ''}
              width={40}
              onChange={(event) => updateTracesToLogs({ name: event.currentTarget.value })}
            />
          </InlineField>
        </InlineFieldRow>
      )}

      <InlineFieldRow>
        <InlineField
          tooltip="The logs data source the trace is going to navigate to"
          label="Data source"
          labelWidth={26}
        >
          <DataSourcePicker
            inputId={`trace-to-logs-data-source-picker${idSuffix}`}
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
          ariaLabel={hasMultipleDestinations ? `${getTimeShiftLabel('start')} for ${destinationLabel}` : undefined}
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
          ariaLabel={hasMultipleDestinations ? `${getTimeShiftLabel('end')} for ${destinationLabel}` : undefined}
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
        id={`filterByTraceID${idSuffix}`}
        value={Boolean(traceToLogs.filterByTraceID)}
        onChange={(val) => updateTracesToLogs({ filterByTraceID: val })}
      />
      <IdFilter
        disabled={customQuery}
        type={'span'}
        id={`filterBySpanID${idSuffix}`}
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
            id={`customQuerySwitch${idSuffix}`}
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

export const TraceToLogsSection = ({
  options,
  onOptionsChange,
  allowMultipleDestinations,
}: DataSourcePluginOptionsEditorProps & Pick<Props, 'allowMultipleDestinations'>) => {
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
      <TraceToLogsSettings
        options={options}
        onOptionsChange={onOptionsChange}
        allowMultipleDestinations={allowMultipleDestinations}
      />
    </ConfigSection>
  );
};
