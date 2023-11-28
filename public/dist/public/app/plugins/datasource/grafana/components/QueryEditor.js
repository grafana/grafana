import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { PureComponent } from 'react';
import { dataFrameFromJSON, rangeUtil, dataFrameToJSON, getValueFormat, formattedValueToString, } from '@grafana/data';
import { config, getBackendSrv, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { InlineField, Select, Alert, Input, InlineFieldRow, InlineLabel, FileDropzone, FileDropzoneDefaultChildren, withTheme2, } from '@grafana/ui';
import { hasAlphaPanels } from 'app/core/config';
import * as DFImport from 'app/features/dataframe-import';
import { defaultQuery, GrafanaQueryType } from '../types';
import SearchEditor from './SearchEditor';
const labelWidth = 12;
export class UnthemedQueryEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.state = { channels: [], channelFields: {} };
        this.queryTypes = [
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
        this.onQueryTypeChange = (sel) => {
            const { onChange, query, onRunQuery } = this.props;
            onChange(Object.assign(Object.assign({}, query), { queryType: sel.value }));
            onRunQuery();
            // Reload the channel list
            this.loadChannelInfo();
        };
        this.onChannelChange = (sel) => {
            const { onChange, query, onRunQuery } = this.props;
            onChange(Object.assign(Object.assign({}, query), { channel: sel === null || sel === void 0 ? void 0 : sel.value }));
            onRunQuery();
        };
        this.onFieldNamesChange = (item) => {
            var _a, _b, _c;
            const { onChange, query, onRunQuery } = this.props;
            let fields = [];
            if (Array.isArray(item)) {
                fields = item.map((v) => v.value);
            }
            else if (item.value) {
                fields = [item.value];
            }
            // When adding the first field, also add time (if it exists)
            if (fields.length === 1 && !((_b = (_a = query.filter) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b.length) && query.channel) {
                const names = (_c = this.state.channelFields[query.channel]) !== null && _c !== void 0 ? _c : [];
                const tf = names.find((f) => f.value === 'time' || f.value === 'Time');
                if (tf && tf.value && tf.value !== fields[0]) {
                    fields = [tf.value, ...fields];
                }
            }
            onChange(Object.assign(Object.assign({}, query), { filter: Object.assign(Object.assign({}, query.filter), { fields }) }));
            onRunQuery();
        };
        this.checkAndUpdateValue = (key, txt) => {
            const { onChange, query, onRunQuery } = this.props;
            if (key === 'buffer') {
                let buffer;
                if (txt) {
                    try {
                        buffer = rangeUtil.intervalToSeconds(txt) * 1000;
                    }
                    catch (err) {
                        console.warn('ERROR', err);
                    }
                }
                onChange(Object.assign(Object.assign({}, query), { buffer }));
            }
            else {
                onChange(Object.assign(Object.assign({}, query), { [key]: txt }));
            }
            onRunQuery();
        };
        this.handleEnterKey = (e) => {
            if (e.key !== 'Enter') {
                return;
            }
            this.checkAndUpdateValue('buffer', e.currentTarget.value);
        };
        this.handleBlur = (e) => {
            this.checkAndUpdateValue('buffer', e.currentTarget.value);
        };
        this.onFolderChanged = (sel) => {
            const { onChange, query, onRunQuery } = this.props;
            onChange(Object.assign(Object.assign({}, query), { path: sel === null || sel === void 0 ? void 0 : sel.value }));
            onRunQuery();
        };
        // Skip rendering the file list as we're handling that in this component instead.
        this.fileListRenderer = (file, removeFile) => {
            return null;
        };
        this.onFileDrop = (acceptedFiles, fileRejections, event) => {
            DFImport.filesToDataframes(acceptedFiles).subscribe((next) => {
                const snapshot = [];
                next.dataFrames.forEach((df) => {
                    const dataframeJson = dataFrameToJSON(df);
                    snapshot.push(dataframeJson);
                });
                this.props.onChange(Object.assign(Object.assign({}, this.props.query), { file: { name: next.file.name, size: next.file.size }, queryType: GrafanaQueryType.Snapshot, snapshot }));
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
        this.onSearchChange = (search) => {
            const { query, onChange, onRunQuery } = this.props;
            onChange(Object.assign(Object.assign({}, query), { search }));
            onRunQuery();
        };
        if (config.featureToggles.panelTitleSearch && hasAlphaPanels) {
            this.queryTypes.push({
                label: 'Search',
                value: GrafanaQueryType.Search,
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
        getBackendSrv()
            .fetch({ url: 'api/live/list' })
            .subscribe({
            next: (v) => {
                var _a;
                const channelInfo = (_a = v.data) === null || _a === void 0 ? void 0 : _a.channels;
                if (channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.length) {
                    const channelFields = {};
                    const channels = channelInfo.map((c) => {
                        if (c.data) {
                            const distinctFields = new Set();
                            const frame = dataFrameFromJSON(c.data);
                            for (const f of frame.fields) {
                                distinctFields.add(f.name);
                            }
                            channelFields[c.channel] = Array.from(distinctFields).map((n) => ({
                                value: n,
                                label: n,
                            }));
                        }
                        return {
                            value: c.channel,
                            label: c.channel + ' [' + c.minute_rate + ' msg/min]',
                        };
                    });
                    this.setState({ channelFields, channels });
                }
            },
        });
    }
    loadFolderInfo() {
        const query = {
            targets: [{ queryType: GrafanaQueryType.List, refId: 'A' }],
        };
        getDataSourceSrv()
            .get('-- Grafana --')
            .then((ds) => {
            const gds = ds;
            gds.query(query).subscribe({
                next: (rsp) => {
                    if (rsp.data.length) {
                        const names = rsp.data[0].fields[0];
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
    renderMeasurementsQuery() {
        var _a;
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
        const distinctFields = new Set();
        const fields = channel ? (_a = channelFields[channel]) !== null && _a !== void 0 ? _a : [] : [];
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
        if (filter === null || filter === void 0 ? void 0 : filter.fields) {
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
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineField, { label: "Channel", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { options: channels, value: currentChannel || '', onChange: this.onChannelChange, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "Select measurements channel", isClearable: true, noOptionsMessage: "Enter channel name", formatCreateLabel: (input) => `Connect to: ${input}` }))),
            channel && (React.createElement("div", { className: "gf-form" },
                React.createElement(InlineField, { label: "Fields", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { options: fields, value: (filter === null || filter === void 0 ? void 0 : filter.fields) || [], onChange: this.onFieldNamesChange, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "All fields", isClearable: true, noOptionsMessage: "Unable to list all fields", formatCreateLabel: (input) => `Field: ${input}`, isSearchable: true, isMulti: true })),
                React.createElement(InlineField, { label: "Buffer" },
                    React.createElement(Input, { placeholder: "Auto", width: 12, defaultValue: formattedTime, onKeyDown: this.handleEnterKey, onBlur: this.handleBlur, spellCheck: false })))),
            React.createElement(Alert, { title: "Grafana Live - Measurements", severity: "info" }, "This supports real-time event streams in Grafana core. This feature is under heavy development. Expect the interfaces and structures to change as this becomes more production ready.")));
    }
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
        return (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Path", grow: true, labelWidth: labelWidth },
                React.createElement(Select, { options: folders, value: currentFolder || '', onChange: this.onFolderChanged, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "Select folder", isClearable: true, formatCreateLabel: (input) => `Folder: ${input}` }))));
    }
    renderSnapshotQuery() {
        var _a, _b, _c, _d;
        const { query, theme } = this.props;
        const file = query.file;
        const styles = getStyles(theme);
        const fileSize = getValueFormat('decbytes')(file ? file.size : 0);
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Snapshot", grow: true, labelWidth: labelWidth },
                    React.createElement(InlineLabel, null, pluralize('frame', (_b = (_a = query.snapshot) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0, true)))),
            config.featureToggles.editPanelCSVDragAndDrop && (React.createElement(React.Fragment, null,
                React.createElement(FileDropzone, { readAs: "readAsArrayBuffer", fileListRenderer: this.fileListRenderer, options: {
                        onDrop: this.onFileDrop,
                        maxSize: DFImport.maxFileSize,
                        multiple: false,
                        accept: DFImport.acceptedFiles,
                    } },
                    React.createElement(FileDropzoneDefaultChildren, { primaryText: ((_d = (_c = this.props) === null || _c === void 0 ? void 0 : _c.query) === null || _d === void 0 ? void 0 : _d.file) ? 'Replace file' : 'Drop file here or click to upload' })),
                file && (React.createElement("div", { className: styles.file },
                    React.createElement("span", null, file === null || file === void 0 ? void 0 : file.name),
                    React.createElement("span", null,
                        React.createElement("span", null, formattedValueToString(fileSize)))))))));
    }
    render() {
        var _a;
        const query = Object.assign(Object.assign({}, defaultQuery), this.props.query);
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
        return (React.createElement(React.Fragment, null,
            queryType === GrafanaQueryType.Search && (React.createElement(Alert, { title: "Grafana Search", severity: "info" }, "Using this datasource to call the new search system is experimental, and subject to change at any time without notice.")),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { options: queryTypes, value: queryTypes.find((v) => v.value === queryType) || queryTypes[0], onChange: this.onQueryTypeChange }))),
            queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery(),
            queryType === GrafanaQueryType.List && this.renderListPublicFiles(),
            queryType === GrafanaQueryType.Snapshot && this.renderSnapshotQuery(),
            queryType === GrafanaQueryType.Search && (React.createElement(SearchEditor, { value: (_a = query.search) !== null && _a !== void 0 ? _a : {}, onChange: this.onSearchChange }))));
    }
}
export const QueryEditor = withTheme2(UnthemedQueryEditor);
function getStyles(theme) {
    return {
        file: css `
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(2)};
      border: 1px dashed ${theme.colors.border.medium};
      background-color: ${theme.colors.background.secondary};
      margin-top: ${theme.spacing(1)};
    `,
    };
}
//# sourceMappingURL=QueryEditor.js.map