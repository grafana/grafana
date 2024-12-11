import { css } from '@emotion/css';
import pluralize from 'pluralize';
import { PureComponent } from 'react';
import * as React from 'react';
import { DropEvent, FileRejection } from 'react-dropzone';

import {
  QueryEditorProps,
  SelectableValue,
  rangeUtil,
  DataQueryRequest,
  DataFrameJSON,
  dataFrameToJSON,
  GrafanaTheme2,
  getValueFormat,
  formattedValueToString,
  Field,
} from '@grafana/data';
import { config, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import {
  InlineField,
  Select,
  Alert,
  Input,
  InlineFieldRow,
  InlineLabel,
  FileDropzone,
  FileDropzoneDefaultChildren,
  DropzoneFile,
  Themeable2,
  withTheme2,
  Stack,
} from '@grafana/ui';
import { hasAlphaPanels } from 'app/core/config';
import * as DFImport from 'app/features/dataframe-import';
import { getManagedChannelInfo } from 'app/features/live/info';
import { SearchQuery } from 'app/features/search/service/types';

import { GrafanaDatasource } from '../datasource';
import { defaultQuery, GrafanaQuery, GrafanaQueryType } from '../types';

import SearchEditor from './SearchEditor';

interface Props extends QueryEditorProps<GrafanaDatasource, GrafanaQuery>, Themeable2 {}

const labelWidth = 12;

interface State {
  channels: Array<SelectableValue<string>>;
  channelFields: Record<string, Array<SelectableValue<string>>>;
  folders?: Array<SelectableValue<string>>;
}

export class UnthemedQueryEditor extends PureComponent<Props, State> {
  state: State = { channels: [], channelFields: {} };

  queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
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

  constructor(props: Props) {
    super(props);

    if (config.featureToggles.panelTitleSearch && hasAlphaPanels) {
      this.queryTypes.push({
        label: 'Search',
        value: GrafanaQueryType.Search,
        description: 'Search for grafana resources',
      });
    }
    if (config.featureToggles.unifiedStorageSearch) {
      this.queryTypes.push({
        label: 'Search (experimental)',
        value: GrafanaQueryType.SearchNext,
        description: 'Search for grafana resources',
      });
    }
    if (config.featureToggles.editPanelCSVDragAndDrop) {
      this.queryTypes.push({
        label: 'Spreadsheet or snapshot',
        value: GrafanaQueryType.Snapshot,
        description: 'Query an uploaded spreadsheet or a snapshot',
      });
    }
  }

  loadChannelInfo() {
    getManagedChannelInfo().then((v) => {
      this.setState(v);
    });
  }

  loadFolderInfo() {
    const query: DataQueryRequest<GrafanaQuery> = {
      targets: [{ queryType: GrafanaQueryType.List, refId: 'A' }],
    } as any;

    getDataSourceSrv()
      .get('-- Grafana --')
      .then((ds) => {
        const gds = ds as GrafanaDatasource;
        gds.query(query).subscribe({
          next: (rsp) => {
            if (rsp.data.length) {
              const names: Field = rsp.data[0].fields[0];
              const folders = names.values.map((v) => ({
                value: v,
                label: v,
              }));
              this.setState({ folders });
            }
          },
        });
      });
  }

  componentDidMount() {
    this.loadChannelInfo();
  }

  onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, queryType: sel.value! });
    onRunQuery();

    // Reload the channel list
    this.loadChannelInfo();
  };

  onChannelChange = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, channel: sel?.value });
    onRunQuery();
  };

  onFieldNamesChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    let fields: string[] = [];
    if (Array.isArray(item)) {
      fields = item.map((v) => v.value);
    } else if (item.value) {
      fields = [item.value];
    }

    // When adding the first field, also add time (if it exists)
    if (fields.length === 1 && !query.filter?.fields?.length && query.channel) {
      const names = this.state.channelFields[query.channel] ?? [];
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

  checkAndUpdateValue = (key: keyof GrafanaQuery, txt: string) => {
    const { onChange, query, onRunQuery } = this.props;
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

  handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }
    this.checkAndUpdateValue('buffer', e.currentTarget.value);
  };

  handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    this.checkAndUpdateValue('buffer', e.currentTarget.value);
  };

  renderMeasurementsQuery() {
    let { channel, filter, buffer } = this.props.query;
    let { channels, channelFields } = this.state;
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
    // if (data && data.series?.length) {
    //   for (const frame of data.series) {
    //     for (const field of frame.fields) {
    //       if (distinctFields.has(field.name) || !field.name) {
    //         continue;
    //       }
    //       fields.push({
    //         value: field.name,
    //         label: field.name,
    //         description: `(${getFrameDisplayName(frame)} / ${field.type})`,
    //       });
    //       distinctFields.add(field.name);
    //     }
    //   }
    // }
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
            onChange={this.onChannelChange}
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
                onChange={this.onFieldNamesChange}
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
                onKeyDown={this.handleEnterKey}
                onBlur={this.handleBlur}
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
  }

  onFolderChanged = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, path: sel?.value });
    onRunQuery();
  };

  renderListPublicFiles() {
    let { path } = this.props.query;
    let { folders } = this.state;
    if (!folders) {
      folders = [];
      this.loadFolderInfo();
    }
    const currentFolder = folders.find((f) => f.value === path);
    if (path && !currentFolder) {
      folders = [
        ...folders,
        {
          value: path,
          label: path,
        },
      ];
    }

    return (
      <InlineFieldRow>
        <InlineField label="Path" grow={true} labelWidth={labelWidth}>
          <Select
            options={folders}
            value={currentFolder || ''}
            onChange={this.onFolderChanged}
            allowCustomValue={true}
            backspaceRemovesValue={true}
            placeholder="Select folder"
            isClearable={true}
            formatCreateLabel={(input: string) => `Folder: ${input}`}
          />
        </InlineField>
      </InlineFieldRow>
    );
  }

  // Skip rendering the file list as we're handling that in this component instead.
  fileListRenderer = (file: DropzoneFile, removeFile: (file: DropzoneFile) => void) => {
    return null;
  };

  onFileDrop = (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    DFImport.filesToDataframes(acceptedFiles).subscribe((next) => {
      const snapshot: DataFrameJSON[] = [];
      next.dataFrames.forEach((df) => {
        const dataframeJson = dataFrameToJSON(df);
        snapshot.push(dataframeJson);
      });
      this.props.onChange({
        ...this.props.query,
        file: { name: next.file.name, size: next.file.size },
        queryType: GrafanaQueryType.Snapshot,
        snapshot,
      });
      this.props.onRunQuery();

      reportInteraction('grafana_datasource_drop_files', {
        number_of_files: fileRejections.length + acceptedFiles.length,
        accepted_files: acceptedFiles.map((a) => {
          return { type: a.type, size: a.size };
        }),
        rejected_files: fileRejections.map((r) => {
          return { type: r.file.type, size: r.file.size };
        }),
      });
    });
  };

  renderSnapshotQuery() {
    const { query, theme } = this.props;
    const file = query.file;
    const styles = getStyles(theme);
    const fileSize = getValueFormat('decbytes')(file ? file.size : 0);

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Snapshot" grow={true} labelWidth={labelWidth}>
            <InlineLabel>{pluralize('frame', query.snapshot?.length ?? 0, true)}</InlineLabel>
          </InlineField>
        </InlineFieldRow>
        {config.featureToggles.editPanelCSVDragAndDrop && (
          <>
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={this.fileListRenderer}
              options={{
                onDrop: this.onFileDrop,
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
              }}
            >
              <FileDropzoneDefaultChildren
                primaryText={this.props?.query?.file ? 'Replace file' : 'Drop file here or click to upload'}
              />
            </FileDropzone>
            {file && (
              <div className={styles.file}>
                <span>{file?.name}</span>
                <span>
                  <span>{formattedValueToString(fileSize)}</span>
                </span>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  onSearchChange = (search: SearchQuery) => {
    const { query, onChange, onRunQuery } = this.props;

    onChange({
      ...query,
      search,
    });
    onRunQuery();
  };

  onSearchNextChange = (search: SearchQuery) => {
    const { query, onChange, onRunQuery } = this.props;

    onChange({
      ...query,
      searchNext: search,
    });
    onRunQuery();
  };

  render() {
    const query = {
      ...defaultQuery,
      ...this.props.query,
    };

    const { queryType } = query;

    // Only show "snapshot" when it already exists
    let queryTypes = this.queryTypes;
    if (queryType === GrafanaQueryType.Snapshot && !config.featureToggles.editPanelCSVDragAndDrop) {
      queryTypes = [
        ...this.queryTypes,
        {
          label: 'Snapshot',
          value: queryType,
        },
      ];
    }

    return (
      <>
        {queryType === GrafanaQueryType.Search && (
          <Alert title="Grafana Search" severity="info">
            Using this datasource to call the new search system is experimental, and subject to change at any time
            without notice.
          </Alert>
        )}
        <InlineFieldRow>
          <InlineField label="Query type" grow={true} labelWidth={labelWidth}>
            <Select
              options={queryTypes}
              value={queryTypes.find((v) => v.value === queryType) || queryTypes[0]}
              onChange={this.onQueryTypeChange}
            />
          </InlineField>
        </InlineFieldRow>
        {queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery()}
        {queryType === GrafanaQueryType.List && this.renderListPublicFiles()}
        {queryType === GrafanaQueryType.Snapshot && this.renderSnapshotQuery()}
        {queryType === GrafanaQueryType.Search && (
          <SearchEditor value={query.search ?? {}} onChange={this.onSearchChange} />
        )}
        {queryType === GrafanaQueryType.SearchNext && (
          <SearchEditor value={query.searchNext ?? {}} onChange={this.onSearchNextChange} />
        )}
      </>
    );
  }
}

export const QueryEditor = withTheme2(UnthemedQueryEditor);

function getStyles(theme: GrafanaTheme2) {
  return {
    file: css({
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(2),
      border: `1px dashed ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
      marginTop: theme.spacing(1),
    }),
  };
}
