import pluralize from 'pluralize';
import { memo, useCallback, useEffect, useState, type KeyboardEvent, type FocusEvent } from 'react';

import {
  type QueryEditorProps,
  type SelectableValue,
  rangeUtil,
  type DataQueryRequest,
  type Field,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { InlineField, Select, Alert, Input, InlineFieldRow, Stack, InlineLabel } from '@grafana/ui';
import { getManagedChannelInfo } from 'app/features/live/info';

import { type GrafanaDatasource } from '../datasource';
import { defaultQuery, type GrafanaQuery, GrafanaQueryType } from '../types';

import { RandomWalkEditor } from './RandomWalkEditor';

interface Props extends QueryEditorProps<GrafanaDatasource, GrafanaQuery> {}

const labelWidth = 12;

const queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
  {
    label: 'Random Walk',
    value: GrafanaQueryType.RandomWalk,
    description: 'Random signal within the selected time range',
  },
  {
    label: 'Live Measurements',
    value: GrafanaQueryType.LiveMeasurements,
    description: 'Stream real-time measurements from Grafana',
  },
  {
    label: 'List public files',
    value: GrafanaQueryType.List,
    description: 'Show directory listings for public resources',
  },
];

interface ChannelInfo {
  channels: Array<SelectableValue<string>>;
  channelFields: Record<string, Array<SelectableValue<string>>>;
}

export const QueryEditor = memo(function QueryEditor(props: Props) {
  const { onChange, onRunQuery } = props;
  const [channelInfo, setChannelInfo] = useState<ChannelInfo>({ channels: [], channelFields: {} });
  const [folders, setFolders] = useState<Array<SelectableValue<string>>>();

  const query = {
    ...defaultQuery,
    ...props.query,
  };
  const { queryType } = query;

  const loadChannelInfo = useCallback(() => {
    getManagedChannelInfo().then((v) => {
      setChannelInfo(v);
    });
  }, []);

  const loadFolderInfo = useCallback(() => {
    const listQuery: DataQueryRequest<GrafanaQuery> = {
      targets: [{ queryType: GrafanaQueryType.List, refId: 'A' }],
    } as DataQueryRequest<GrafanaQuery>;

    getDataSourceSrv()
      .get('-- Grafana --')
      .then((ds) => {
        const gds = ds as GrafanaDatasource;
        gds.query(listQuery).subscribe({
          next: (rsp) => {
            if (rsp.data.length) {
              const names: Field = rsp.data[0].fields[0];
              setFolders(
                names.values.map((v) => ({
                  value: v,
                  label: v,
                }))
              );
            }
          },
        });
      });
  }, []);

  useEffect(() => {
    loadChannelInfo();
  }, [loadChannelInfo]);

  useEffect(() => {
    if (queryType === GrafanaQueryType.List && !folders) {
      loadFolderInfo();
    }
  }, [queryType, folders, loadFolderInfo]);

  const onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    onChange({ ...query, queryType: sel.value! });
    onRunQuery();

    // Reload the channel list
    loadChannelInfo();
  };

  const onChannelChange = (sel: SelectableValue<string>) => {
    onChange({ ...query, channel: sel?.value });
    onRunQuery();
  };

  const onFieldNamesChange = (item: SelectableValue<string>) => {
    let fields: string[] = [];
    if (Array.isArray(item)) {
      fields = item.map((v) => v.value);
    } else if (item.value) {
      fields = [item.value];
    }

    // When adding the first field, also add time (if it exists)
    if (fields.length === 1 && !query.filter?.fields?.length && query.channel) {
      const names = channelInfo.channelFields[query.channel] ?? [];
      const tf = names.find((f) => f.value === 'time' || f.value === 'Time');
      if (tf && tf.value && tf.value !== fields[0]) {
        fields = [tf.value, ...fields];
      }
    }

    onChange({
      ...query,
      filter: {
        ...query.filter,
        fields,
      },
    });
    onRunQuery();
  };

  const checkAndUpdateValue = (key: keyof GrafanaQuery, txt: string) => {
    if (key === 'buffer') {
      let buffer: number | undefined;
      if (txt) {
        try {
          buffer = rangeUtil.intervalToSeconds(txt) * 1000;
        } catch (err) {
          console.warn('ERROR', err);
        }
      }
      onChange({
        ...query,
        buffer,
      });
    } else {
      onChange({
        ...query,
        [key]: txt,
      });
    }
    onRunQuery();
  };

  const handleEnterKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }
    checkAndUpdateValue('buffer', e.currentTarget.value);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    checkAndUpdateValue('buffer', e.currentTarget.value);
  };

  const onFolderChanged = (sel: SelectableValue<string>) => {
    onChange({ ...query, path: sel?.value });
    onRunQuery();
  };

  const renderMeasurementsQuery = () => {
    let { channel, filter, buffer } = query;
    let { channels, channelFields } = channelInfo;
    let currentChannel = channels.find((c) => c.value === channel);
    if (channel && !currentChannel) {
      currentChannel = {
        value: channel,
        label: channel,
        description: `Connected to ${channel}`,
      };
      channels = [currentChannel, ...channels];
    }

    const distinctFields = new Set<string>();
    const fields: Array<SelectableValue<string>> = channel ? (channelFields[channel] ?? []) : [];

    if (filter?.fields) {
      for (const f of filter.fields) {
        if (!distinctFields.has(f)) {
          fields.push({
            value: f,
            label: `${f} (not loaded)`,
            description: `Configured, but not found in the query results`,
          });
          distinctFields.add(f);
        }
      }
    }

    let formattedTime = '';
    if (buffer) {
      formattedTime = rangeUtil.secondsToHms(buffer / 1000);
    }

    return (
      <>
        <InlineField label="Channel" grow={true} labelWidth={labelWidth}>
          <Select
            options={channels}
            value={currentChannel || ''}
            onChange={onChannelChange}
            allowCustomValue={true}
            backspaceRemovesValue={true}
            placeholder="Select measurements channel"
            isClearable={true}
            noOptionsMessage="Enter channel name"
            formatCreateLabel={(input: string) => `Connect to: ${input}`}
          />
        </InlineField>

        {channel && (
          <Stack direction="row" gap={0}>
            <InlineField label="Fields" grow={true} labelWidth={labelWidth}>
              <Select
                options={fields}
                value={filter?.fields || []}
                onChange={onFieldNamesChange}
                allowCustomValue={true}
                backspaceRemovesValue={true}
                placeholder="All fields"
                isClearable={true}
                noOptionsMessage="Unable to list all fields"
                formatCreateLabel={(input: string) => `Field: ${input}`}
                isSearchable={true}
                isMulti={true}
              />
            </InlineField>
            <InlineField label="Buffer">
              <Input
                placeholder="Auto"
                width={12}
                defaultValue={formattedTime}
                onKeyDown={handleEnterKey}
                onBlur={handleBlur}
                spellCheck={false}
              />
            </InlineField>
          </Stack>
        )}

        <Alert title="Grafana Live - Measurements" severity="info">
          This supports real-time event streams in Grafana core. This feature is under heavy development. Expect the
          interfaces and structures to change as this becomes more production ready.
        </Alert>
      </>
    );
  };

  const renderListPublicFiles = () => {
    const { path } = query;
    const folderList = folders ?? [];
    const currentFolder = folderList.find((f) => f.value === path);
    const displayFolders =
      path && !currentFolder
        ? [
            ...folderList,
            {
              value: path,
              label: path,
            },
          ]
        : folderList;

    return (
      <InlineFieldRow>
        <InlineField label="Path" grow={true} labelWidth={labelWidth}>
          <Select
            options={displayFolders}
            value={currentFolder || ''}
            onChange={onFolderChanged}
            allowCustomValue={true}
            backspaceRemovesValue={true}
            placeholder="Select folder"
            isClearable={true}
            formatCreateLabel={(input: string) => `Folder: ${input}`}
          />
        </InlineField>
      </InlineFieldRow>
    );
  };

  const renderSnapshotQuery = () => {
    return (
      <>
        <InlineFieldRow>
          <InlineField label="Snapshot" grow={true} labelWidth={labelWidth}>
            <InlineLabel>{pluralize('frame', query.snapshot?.length ?? 0, true)}</InlineLabel>
          </InlineField>
        </InlineFieldRow>
      </>
    );
  };

  const renderRandomWalkQuery = () => {
    return <RandomWalkEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />;
  };

  // Only show "snapshot" when it already exists
  let queryTypeOptions = queryTypes;
  if (queryType === GrafanaQueryType.Snapshot) {
    queryTypeOptions = [
      ...queryTypes,
      {
        label: 'Snapshot',
        value: queryType,
      },
    ];
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type" grow={true} labelWidth={labelWidth}>
          <Select
            options={queryTypeOptions}
            value={queryTypeOptions.find((v) => v.value === queryType) || queryTypeOptions[0]}
            onChange={onQueryTypeChange}
          />
        </InlineField>
      </InlineFieldRow>
      {queryType === GrafanaQueryType.RandomWalk && config.featureToggles.dashboardTemplates && renderRandomWalkQuery()}
      {queryType === GrafanaQueryType.LiveMeasurements && renderMeasurementsQuery()}
      {queryType === GrafanaQueryType.List && renderListPublicFiles()}
      {queryType === GrafanaQueryType.Snapshot && renderSnapshotQuery()}
    </>
  );
});
