import { __read } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { CollapsableSection, Field, Input, RadioButtonGroup, TagsInput } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';
import { TimePickerSettings } from './TimePickerSettings';
import { updateTimeZoneDashboard, updateWeekStartDashboard } from 'app/features/dashboard/state/actions';
var GRAPH_TOOLTIP_OPTIONS = [
    { value: 0, label: 'Default' },
    { value: 1, label: 'Shared crosshair' },
    { value: 2, label: 'Shared Tooltip' },
];
export function GeneralSettingsUnconnected(_a) {
    var dashboard = _a.dashboard, updateTimeZone = _a.updateTimeZone, updateWeekStart = _a.updateWeekStart;
    var _b = __read(useState(0), 2), renderCounter = _b[0], setRenderCounter = _b[1];
    var onFolderChange = function (folder) {
        dashboard.meta.folderId = folder.id;
        dashboard.meta.folderTitle = folder.title;
        dashboard.meta.hasUnsavedFolderChange = true;
    };
    var onBlur = function (event) {
        dashboard[event.currentTarget.name] = event.currentTarget.value;
    };
    var onTooltipChange = function (graphTooltip) {
        dashboard.graphTooltip = graphTooltip;
        setRenderCounter(renderCounter + 1);
    };
    var onRefreshIntervalChange = function (intervals) {
        dashboard.timepicker.refresh_intervals = intervals.filter(function (i) { return i.trim() !== ''; });
    };
    var onNowDelayChange = function (nowDelay) {
        dashboard.timepicker.nowDelay = nowDelay;
    };
    var onHideTimePickerChange = function (hide) {
        dashboard.timepicker.hidden = hide;
        setRenderCounter(renderCounter + 1);
    };
    var onLiveNowChange = function (v) {
        dashboard.liveNow = v;
        setRenderCounter(renderCounter + 1);
    };
    var onTimeZoneChange = function (timeZone) {
        dashboard.timezone = timeZone;
        setRenderCounter(renderCounter + 1);
        updateTimeZone(timeZone);
    };
    var onWeekStartChange = function (weekStart) {
        dashboard.weekStart = weekStart;
        setRenderCounter(renderCounter + 1);
        updateWeekStart(weekStart);
    };
    var onTagsChange = function (tags) {
        dashboard.tags = tags;
        setRenderCounter(renderCounter + 1);
    };
    var onEditableChange = function (value) {
        dashboard.editable = value;
        setRenderCounter(renderCounter + 1);
    };
    var editableOptions = [
        { label: 'Editable', value: true },
        { label: 'Read-only', value: false },
    ];
    return (React.createElement("div", { style: { maxWidth: '600px' } },
        React.createElement("h3", { className: "dashboard-settings__header", "aria-label": selectors.pages.Dashboard.Settings.General.title }, "General"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(Field, { label: "Name" },
                React.createElement(Input, { id: "title-input", name: "title", onBlur: onBlur, defaultValue: dashboard.title })),
            React.createElement(Field, { label: "Description" },
                React.createElement(Input, { id: "description-input", name: "description", onBlur: onBlur, defaultValue: dashboard.description })),
            React.createElement(Field, { label: "Tags" },
                React.createElement(TagsInput, { tags: dashboard.tags, onChange: onTagsChange })),
            React.createElement(Field, { label: "Folder" },
                React.createElement(FolderPicker, { inputId: "dashboard-folder-input", initialTitle: dashboard.meta.folderTitle, initialFolderId: dashboard.meta.folderId, onChange: onFolderChange, enableCreateNew: true, dashboardId: dashboard.id, skipInitialLoad: true })),
            React.createElement(Field, { label: "Editable", description: "Set to read-only to disable all editing. Reload the dashboard for changes to take effect" },
                React.createElement(RadioButtonGroup, { value: dashboard.editable, options: editableOptions, onChange: onEditableChange }))),
        React.createElement(TimePickerSettings, { onTimeZoneChange: onTimeZoneChange, onWeekStartChange: onWeekStartChange, onRefreshIntervalChange: onRefreshIntervalChange, onNowDelayChange: onNowDelayChange, onHideTimePickerChange: onHideTimePickerChange, onLiveNowChange: onLiveNowChange, refreshIntervals: dashboard.timepicker.refresh_intervals, timePickerHidden: dashboard.timepicker.hidden, nowDelay: dashboard.timepicker.nowDelay, timezone: dashboard.timezone, weekStart: dashboard.weekStart, liveNow: dashboard.liveNow }),
        React.createElement(CollapsableSection, { label: "Panel options", isOpen: true },
            React.createElement(Field, { label: "Graph tooltip", description: "Controls tooltip and hover highlight behavior across different panels" },
                React.createElement(RadioButtonGroup, { onChange: onTooltipChange, options: GRAPH_TOOLTIP_OPTIONS, value: dashboard.graphTooltip }))),
        React.createElement("div", { className: "gf-form-button-row" }, dashboard.meta.canSave && React.createElement(DeleteDashboardButton, { dashboard: dashboard }))));
}
var mapDispatchToProps = {
    updateTimeZone: updateTimeZoneDashboard,
    updateWeekStart: updateWeekStartDashboard,
};
var connector = connect(null, mapDispatchToProps);
export var GeneralSettings = connector(GeneralSettingsUnconnected);
//# sourceMappingURL=GeneralSettings.js.map