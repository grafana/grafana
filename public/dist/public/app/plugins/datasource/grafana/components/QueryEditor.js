import { __assign, __extends, __read, __spreadArray, __values } from "tslib";
import React, { PureComponent } from 'react';
import { InlineField, Select, Alert, Input, InlineFieldRow } from '@grafana/ui';
import { dataFrameFromJSON, rangeUtil, } from '@grafana/data';
import { defaultQuery, GrafanaQueryType } from '../types';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
var labelWidth = 12;
var QueryEditor = /** @class */ (function (_super) {
    __extends(QueryEditor, _super);
    function QueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { channels: [], channelFields: {} };
        _this.queryTypes = [
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
        _this.onQueryTypeChange = function (sel) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query, onRunQuery = _a.onRunQuery;
            onChange(__assign(__assign({}, query), { queryType: sel.value }));
            onRunQuery();
            // Reload the channel list
            _this.loadChannelInfo();
        };
        _this.onChannelChange = function (sel) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query, onRunQuery = _a.onRunQuery;
            onChange(__assign(__assign({}, query), { channel: sel === null || sel === void 0 ? void 0 : sel.value }));
            onRunQuery();
        };
        _this.onFieldNamesChange = function (item) {
            var _a, _b, _c;
            var _d = _this.props, onChange = _d.onChange, query = _d.query, onRunQuery = _d.onRunQuery;
            var fields = [];
            if (Array.isArray(item)) {
                fields = item.map(function (v) { return v.value; });
            }
            else if (item.value) {
                fields = [item.value];
            }
            // When adding the first field, also add time (if it exists)
            if (fields.length === 1 && !((_b = (_a = query.filter) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b.length) && query.channel) {
                var names = (_c = _this.state.channelFields[query.channel]) !== null && _c !== void 0 ? _c : [];
                var tf = names.find(function (f) { return f.value === 'time' || f.value === 'Time'; });
                if (tf && tf.value && tf.value !== fields[0]) {
                    fields = __spreadArray([tf.value], __read(fields), false);
                }
            }
            onChange(__assign(__assign({}, query), { filter: __assign(__assign({}, query.filter), { fields: fields }) }));
            onRunQuery();
        };
        _this.checkAndUpdateBuffer = function (txt) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query, onRunQuery = _a.onRunQuery;
            var buffer;
            if (txt) {
                try {
                    buffer = rangeUtil.intervalToSeconds(txt) * 1000;
                }
                catch (err) {
                    console.warn('ERROR', err);
                }
            }
            onChange(__assign(__assign({}, query), { buffer: buffer }));
            onRunQuery();
        };
        _this.handleEnterKey = function (e) {
            if (e.key !== 'Enter') {
                return;
            }
            _this.checkAndUpdateBuffer(e.target.value);
        };
        _this.handleBlur = function (e) {
            _this.checkAndUpdateBuffer(e.target.value);
        };
        _this.onFolderChanged = function (sel) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query, onRunQuery = _a.onRunQuery;
            onChange(__assign(__assign({}, query), { path: sel === null || sel === void 0 ? void 0 : sel.value }));
            onRunQuery();
        };
        return _this;
    }
    QueryEditor.prototype.loadChannelInfo = function () {
        var _this = this;
        getBackendSrv()
            .fetch({ url: 'api/live/list' })
            .subscribe({
            next: function (v) {
                var _a;
                var channelInfo = (_a = v.data) === null || _a === void 0 ? void 0 : _a.channels;
                if (channelInfo === null || channelInfo === void 0 ? void 0 : channelInfo.length) {
                    var channelFields_1 = {};
                    var channels = channelInfo.map(function (c) {
                        var e_1, _a;
                        if (c.data) {
                            var distinctFields = new Set();
                            var frame = dataFrameFromJSON(c.data);
                            try {
                                for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
                                    var f = _c.value;
                                    distinctFields.add(f.name);
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                            channelFields_1[c.channel] = Array.from(distinctFields).map(function (n) { return ({
                                value: n,
                                label: n,
                            }); });
                        }
                        return {
                            value: c.channel,
                            label: c.channel + ' [' + c.minute_rate + ' msg/min]',
                        };
                    });
                    _this.setState({ channelFields: channelFields_1, channels: channels });
                }
            },
        });
    };
    QueryEditor.prototype.loadFolderInfo = function () {
        var _this = this;
        var query = {
            targets: [{ queryType: GrafanaQueryType.List, refId: 'A' }],
        };
        getDataSourceSrv()
            .get('-- Grafana --')
            .then(function (ds) {
            var gds = ds;
            gds.query(query).subscribe({
                next: function (rsp) {
                    if (rsp.data.length) {
                        var names = rsp.data[0].fields[0];
                        var folders = names.values.toArray().map(function (v) { return ({
                            value: v,
                            label: v,
                        }); });
                        _this.setState({ folders: folders });
                    }
                },
            });
        });
    };
    QueryEditor.prototype.componentDidMount = function () {
        this.loadChannelInfo();
    };
    QueryEditor.prototype.renderMeasurementsQuery = function () {
        var e_2, _a;
        var _b;
        var _c = this.props.query, channel = _c.channel, filter = _c.filter, buffer = _c.buffer;
        var _d = this.state, channels = _d.channels, channelFields = _d.channelFields;
        var currentChannel = channels.find(function (c) { return c.value === channel; });
        if (channel && !currentChannel) {
            currentChannel = {
                value: channel,
                label: channel,
                description: "Connected to " + channel,
            };
            channels = __spreadArray([currentChannel], __read(channels), false);
        }
        var distinctFields = new Set();
        var fields = channel ? (_b = channelFields[channel]) !== null && _b !== void 0 ? _b : [] : [];
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
            try {
                for (var _e = __values(filter.fields), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var f = _f.value;
                    if (!distinctFields.has(f)) {
                        fields.push({
                            value: f,
                            label: f + " (not loaded)",
                            description: "Configured, but not found in the query results",
                        });
                        distinctFields.add(f);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        var formattedTime = '';
        if (buffer) {
            formattedTime = rangeUtil.secondsToHms(buffer / 1000);
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form" },
                React.createElement(InlineField, { label: "Channel", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { menuShouldPortal: true, options: channels, value: currentChannel || '', onChange: this.onChannelChange, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "Select measurements channel", isClearable: true, noOptionsMessage: "Enter channel name", formatCreateLabel: function (input) { return "Connect to: " + input; } }))),
            channel && (React.createElement("div", { className: "gf-form" },
                React.createElement(InlineField, { label: "Fields", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { menuShouldPortal: true, options: fields, value: (filter === null || filter === void 0 ? void 0 : filter.fields) || [], onChange: this.onFieldNamesChange, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "All fields", isClearable: true, noOptionsMessage: "Unable to list all fields", formatCreateLabel: function (input) { return "Field: " + input; }, isSearchable: true, isMulti: true })),
                React.createElement(InlineField, { label: "Buffer" },
                    React.createElement(Input, { placeholder: "Auto", width: 12, defaultValue: formattedTime, onKeyDown: this.handleEnterKey, onBlur: this.handleBlur, spellCheck: false })))),
            React.createElement(Alert, { title: "Grafana Live - Measurements", severity: "info" }, "This supports real-time event streams in Grafana core. This feature is under heavy development. Expect the interfaces and structures to change as this becomes more production ready.")));
    };
    QueryEditor.prototype.renderListPublicFiles = function () {
        var path = this.props.query.path;
        var folders = this.state.folders;
        if (!folders) {
            folders = [];
            this.loadFolderInfo();
        }
        var currentFolder = folders.find(function (f) { return f.value === path; });
        if (path && !currentFolder) {
            folders = __spreadArray(__spreadArray([], __read(folders), false), [
                {
                    value: path,
                    label: path,
                },
            ], false);
        }
        return (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Path", grow: true, labelWidth: labelWidth },
                React.createElement(Select, { menuShouldPortal: true, options: folders, value: currentFolder || '', onChange: this.onFolderChanged, allowCustomValue: true, backspaceRemovesValue: true, placeholder: "Select folder", isClearable: true, formatCreateLabel: function (input) { return "Folder: " + input; } }))));
    };
    QueryEditor.prototype.render = function () {
        var query = __assign(__assign({}, defaultQuery), this.props.query);
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type", grow: true, labelWidth: labelWidth },
                    React.createElement(Select, { menuShouldPortal: true, options: this.queryTypes, value: this.queryTypes.find(function (v) { return v.value === query.queryType; }) || this.queryTypes[0], onChange: this.onQueryTypeChange }))),
            query.queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery(),
            query.queryType === GrafanaQueryType.List && this.renderListPublicFiles()));
    };
    return QueryEditor;
}(PureComponent));
export { QueryEditor };
//# sourceMappingURL=QueryEditor.js.map