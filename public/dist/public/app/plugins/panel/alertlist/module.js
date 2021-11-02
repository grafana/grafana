import { __assign } from "tslib";
import React from 'react';
import { PanelPlugin } from '@grafana/data';
import { TagsInput } from '@grafana/ui';
import { AlertList } from './AlertList';
import { UnifiedAlertList } from './UnifiedAlertList';
import { ShowOption, SortOrder } from './types';
import { alertListPanelMigrationHandler } from './AlertListMigrationHandler';
import { config } from '@grafana/runtime';
import { RuleFolderPicker } from 'app/features/alerting/unified/components/rule-editor/RuleFolderPicker';
import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker, } from '../../../core/components/Select/ReadonlyFolderPicker/ReadonlyFolderPicker';
import { AlertListSuggestionsSupplier } from './suggestions';
function showIfCurrentState(options) {
    return options.showOptions === ShowOption.Current;
}
var alertList = new PanelPlugin(AlertList)
    .setPanelOptions(function (builder) {
    builder
        .addSelect({
        name: 'Show',
        path: 'showOptions',
        settings: {
            options: [
                { label: 'Current state', value: ShowOption.Current },
                { label: 'Recent state changes', value: ShowOption.RecentChanges },
            ],
        },
        defaultValue: ShowOption.Current,
        category: ['Options'],
    })
        .addNumberInput({
        name: 'Max items',
        path: 'maxItems',
        defaultValue: 10,
        category: ['Options'],
    })
        .addSelect({
        name: 'Sort order',
        path: 'sortOrder',
        settings: {
            options: [
                { label: 'Alphabetical (asc)', value: SortOrder.AlphaAsc },
                { label: 'Alphabetical (desc)', value: SortOrder.AlphaDesc },
                { label: 'Importance', value: SortOrder.Importance },
                { label: 'Time (asc)', value: SortOrder.TimeAsc },
                { label: 'Time (desc)', value: SortOrder.TimeDesc },
            ],
        },
        defaultValue: SortOrder.AlphaAsc,
        category: ['Options'],
    })
        .addBooleanSwitch({
        path: 'dashboardAlerts',
        name: 'Alerts from this dashboard',
        defaultValue: false,
        category: ['Options'],
    })
        .addTextInput({
        path: 'alertName',
        name: 'Alert name',
        defaultValue: '',
        category: ['Filter'],
        showIf: showIfCurrentState,
    })
        .addTextInput({
        path: 'dashboardTitle',
        name: 'Dashboard title',
        defaultValue: '',
        category: ['Filter'],
        showIf: showIfCurrentState,
    })
        .addCustomEditor({
        path: 'folderId',
        name: 'Folder',
        id: 'folderId',
        defaultValue: null,
        editor: function RenderFolderPicker(_a) {
            var value = _a.value, onChange = _a.onChange;
            return (React.createElement(ReadonlyFolderPicker, { initialFolderId: value, onChange: function (folder) { return onChange(folder === null || folder === void 0 ? void 0 : folder.id); }, extraFolders: [ALL_FOLDER, GENERAL_FOLDER] }));
        },
        category: ['Filter'],
        showIf: showIfCurrentState,
    })
        .addCustomEditor({
        id: 'tags',
        path: 'tags',
        name: 'Tags',
        description: '',
        defaultValue: [],
        editor: function (props) {
            return React.createElement(TagsInput, { tags: props.value, onChange: props.onChange });
        },
        category: ['Filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.ok',
        name: 'Ok',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.paused',
        name: 'Paused',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.no_data',
        name: 'No data',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.execution_error',
        name: 'Execution error',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.alerting',
        name: 'Alerting',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    })
        .addBooleanSwitch({
        path: 'stateFilter.pending',
        name: 'Pending',
        defaultValue: false,
        category: ['State filter'],
        showIf: showIfCurrentState,
    });
})
    .setMigrationHandler(alertListPanelMigrationHandler)
    .setSuggestionsSupplier(new AlertListSuggestionsSupplier());
var unifiedAlertList = new PanelPlugin(UnifiedAlertList).setPanelOptions(function (builder) {
    builder
        .addNumberInput({
        name: 'Max items',
        path: 'maxItems',
        defaultValue: 20,
        category: ['Options'],
    })
        .addSelect({
        name: 'Sort order',
        path: 'sortOrder',
        settings: {
            options: [
                { label: 'Alphabetical (asc)', value: SortOrder.AlphaAsc },
                { label: 'Alphabetical (desc)', value: SortOrder.AlphaDesc },
                { label: 'Importance', value: SortOrder.Importance },
                { label: 'Time (asc)', value: SortOrder.TimeAsc },
                { label: 'Time (desc)', value: SortOrder.TimeDesc },
            ],
        },
        defaultValue: SortOrder.AlphaAsc,
        category: ['Options'],
    })
        .addBooleanSwitch({
        path: 'dashboardAlerts',
        name: 'Alerts from this dashboard',
        defaultValue: false,
        category: ['Options'],
    })
        .addBooleanSwitch({
        path: 'showInstances',
        name: 'Show alert instances',
        defaultValue: false,
        category: ['Options'],
    })
        .addTextInput({
        path: 'alertName',
        name: 'Alert name',
        defaultValue: '',
        category: ['Filter'],
    })
        .addCustomEditor({
        path: 'folder',
        name: 'Folder',
        id: 'folder',
        defaultValue: null,
        editor: function RenderFolderPicker(props) {
            return (React.createElement(RuleFolderPicker, __assign({}, props, { enableReset: true, onChange: function (_a) {
                    var title = _a.title, id = _a.id;
                    return props.onChange({ title: title, id: id });
                } })));
        },
        category: ['Filter'],
    })
        .addBooleanSwitch({
        path: 'stateFilter.firing',
        name: 'Alerting',
        defaultValue: true,
        category: ['State filter'],
    })
        .addBooleanSwitch({
        path: 'stateFilter.pending',
        name: 'Pending',
        defaultValue: true,
        category: ['State filter'],
    })
        .addBooleanSwitch({
        path: 'stateFilter.inactive',
        name: 'Inactive',
        defaultValue: false,
        category: ['State filter'],
    });
});
export var plugin = config.unifiedAlertingEnabled ? unifiedAlertList : alertList;
//# sourceMappingURL=module.js.map