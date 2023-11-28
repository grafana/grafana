import React, { useState } from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { CollapsableSection, Field, Input, RadioButtonGroup, TagsInput, Label, HorizontalGroup, TextArea, } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { updateTimeZoneDashboard, updateWeekStartDashboard } from 'app/features/dashboard/state/actions';
import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';
import { GenAIDashDescriptionButton } from '../GenAI/GenAIDashDescriptionButton';
import { GenAIDashTitleButton } from '../GenAI/GenAIDashTitleButton';
import { TimePickerSettings } from './TimePickerSettings';
const GRAPH_TOOLTIP_OPTIONS = [
    { value: 0, label: 'Default' },
    { value: 1, label: 'Shared crosshair' },
    { value: 2, label: 'Shared Tooltip' },
];
export function GeneralSettingsUnconnected({ dashboard, updateTimeZone, updateWeekStart, sectionNav, }) {
    const [renderCounter, setRenderCounter] = useState(0);
    const [dashboardTitle, setDashboardTitle] = useState(dashboard.title);
    const [dashboardDescription, setDashboardDescription] = useState(dashboard.description);
    const pageNav = config.featureToggles.dockedMegaMenu ? sectionNav.node.parentItem : undefined;
    const onFolderChange = (newUID, newTitle) => {
        dashboard.meta.folderUid = newUID;
        dashboard.meta.folderTitle = newTitle;
        dashboard.meta.hasUnsavedFolderChange = true;
        setRenderCounter(renderCounter + 1);
    };
    const onTitleChange = React.useCallback((title) => {
        dashboard.title = title;
        setDashboardTitle(title);
    }, [setDashboardTitle, dashboard]);
    const onDescriptionChange = React.useCallback((description) => {
        dashboard.description = description;
        setDashboardDescription(description);
    }, [setDashboardDescription, dashboard]);
    const onTooltipChange = (graphTooltip) => {
        dashboard.graphTooltip = graphTooltip;
        setRenderCounter(renderCounter + 1);
    };
    const onRefreshIntervalChange = (intervals) => {
        dashboard.timepicker.refresh_intervals = intervals.filter((i) => i.trim() !== '');
    };
    const onNowDelayChange = (nowDelay) => {
        dashboard.timepicker.nowDelay = nowDelay;
    };
    const onHideTimePickerChange = (hide) => {
        dashboard.timepicker.hidden = hide;
        setRenderCounter(renderCounter + 1);
    };
    const onLiveNowChange = (v) => {
        dashboard.liveNow = v;
        setRenderCounter(renderCounter + 1);
    };
    const onTimeZoneChange = (timeZone) => {
        dashboard.timezone = timeZone;
        setRenderCounter(renderCounter + 1);
        updateTimeZone(timeZone);
    };
    const onWeekStartChange = (weekStart) => {
        dashboard.weekStart = weekStart;
        setRenderCounter(renderCounter + 1);
        updateWeekStart(weekStart);
    };
    const onTagsChange = (tags) => {
        dashboard.tags = tags;
        setRenderCounter(renderCounter + 1);
    };
    const onEditableChange = (value) => {
        dashboard.editable = value;
        setRenderCounter(renderCounter + 1);
    };
    const editableOptions = [
        { label: 'Editable', value: true },
        { label: 'Read-only', value: false },
    ];
    return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
        React.createElement("div", { style: { maxWidth: '600px' } },
            React.createElement(Box, { marginBottom: 5 },
                React.createElement(Field, { label: React.createElement(HorizontalGroup, { justify: "space-between" },
                        React.createElement(Label, { htmlFor: "title-input" },
                            React.createElement(Trans, { i18nKey: "dashboard-settings.general.title-label" }, "Title")),
                        config.featureToggles.dashgpt && (React.createElement(GenAIDashTitleButton, { onGenerate: onTitleChange, dashboard: dashboard }))) },
                    React.createElement(Input, { id: "title-input", name: "title", value: dashboardTitle, onChange: (e) => onTitleChange(e.target.value) })),
                React.createElement(Field, { label: React.createElement(HorizontalGroup, { justify: "space-between" },
                        React.createElement(Label, { htmlFor: "description-input" }, t('dashboard-settings.general.description-label', 'Description')),
                        config.featureToggles.dashgpt && (React.createElement(GenAIDashDescriptionButton, { onGenerate: onDescriptionChange, dashboard: dashboard }))) },
                    React.createElement(TextArea, { id: "description-input", name: "description", value: dashboardDescription, onChange: (e) => onDescriptionChange(e.target.value) })),
                React.createElement(Field, { label: t('dashboard-settings.general.tags-label', 'Tags') },
                    React.createElement(TagsInput, { id: "tags-input", tags: dashboard.tags, onChange: onTagsChange, width: 40 })),
                React.createElement(Field, { label: t('dashboard-settings.general.folder-label', 'Folder') },
                    React.createElement(FolderPicker, { value: dashboard.meta.folderUid, onChange: onFolderChange, 
                        // TODO deprecated props that can be removed once NestedFolderPicker is enabled by default
                        initialTitle: dashboard.meta.folderTitle, inputId: "dashboard-folder-input", enableCreateNew: true, dashboardId: dashboard.id, skipInitialLoad: true })),
                React.createElement(Field, { label: t('dashboard-settings.general.editable-label', 'Editable'), description: t('dashboard-settings.general.editable-description', 'Set to read-only to disable all editing. Reload the dashboard for changes to take effect') },
                    React.createElement(RadioButtonGroup, { value: dashboard.editable, options: editableOptions, onChange: onEditableChange }))),
            React.createElement(TimePickerSettings, { onTimeZoneChange: onTimeZoneChange, onWeekStartChange: onWeekStartChange, onRefreshIntervalChange: onRefreshIntervalChange, onNowDelayChange: onNowDelayChange, onHideTimePickerChange: onHideTimePickerChange, onLiveNowChange: onLiveNowChange, refreshIntervals: dashboard.timepicker.refresh_intervals, timePickerHidden: dashboard.timepicker.hidden, nowDelay: dashboard.timepicker.nowDelay, timezone: dashboard.timezone, weekStart: dashboard.weekStart, liveNow: dashboard.liveNow }),
            React.createElement(CollapsableSection, { label: t('dashboard-settings.general.panel-options-label', 'Panel options'), isOpen: true },
                React.createElement(Field, { label: t('dashboard-settings.general.panel-options-graph-tooltip-label', 'Graph tooltip'), description: t('dashboard-settings.general.panel-options-graph-tooltip-description', 'Controls tooltip and hover highlight behavior across different panels. Reload the dashboard for changes to take effect') },
                    React.createElement(RadioButtonGroup, { onChange: onTooltipChange, options: GRAPH_TOOLTIP_OPTIONS, value: dashboard.graphTooltip }))),
            React.createElement(Box, { marginTop: 3 }, dashboard.meta.canDelete && React.createElement(DeleteDashboardButton, { dashboard: dashboard })))));
}
const mapDispatchToProps = {
    updateTimeZone: updateTimeZoneDashboard,
    updateWeekStart: updateWeekStartDashboard,
};
const connector = connect(null, mapDispatchToProps);
export const GeneralSettings = connector(GeneralSettingsUnconnected);
//# sourceMappingURL=GeneralSettings.js.map