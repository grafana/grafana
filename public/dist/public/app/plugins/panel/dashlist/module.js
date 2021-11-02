import { PanelPlugin } from '@grafana/data';
import { DashList } from './DashList';
import React from 'react';
import { TagsInput } from '@grafana/ui';
import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker, } from '../../../core/components/Select/ReadonlyFolderPicker/ReadonlyFolderPicker';
import { DashListSuggestionsSupplier } from './suggestions';
export var plugin = new PanelPlugin(DashList)
    .setPanelOptions(function (builder) {
    builder
        .addBooleanSwitch({
        path: 'showStarred',
        name: 'Starred',
        defaultValue: true,
    })
        .addBooleanSwitch({
        path: 'showRecentlyViewed',
        name: 'Recently viewed',
        defaultValue: false,
    })
        .addBooleanSwitch({
        path: 'showSearch',
        name: 'Search',
        defaultValue: false,
    })
        .addBooleanSwitch({
        path: 'showHeadings',
        name: 'Show headings',
        defaultValue: true,
    })
        .addNumberInput({
        path: 'maxItems',
        name: 'Max items',
        defaultValue: 10,
    })
        .addTextInput({
        path: 'query',
        name: 'Query',
        defaultValue: '',
    })
        .addCustomEditor({
        path: 'folderId',
        name: 'Folder',
        id: 'folderId',
        defaultValue: undefined,
        editor: function RenderFolderPicker(_a) {
            var value = _a.value, onChange = _a.onChange;
            return (React.createElement(ReadonlyFolderPicker, { initialFolderId: value, onChange: function (folder) { return onChange(folder === null || folder === void 0 ? void 0 : folder.id); }, extraFolders: [ALL_FOLDER, GENERAL_FOLDER] }));
        },
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
    });
})
    .setMigrationHandler(function (panel) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var newOptions = {
        showStarred: (_a = panel.options.showStarred) !== null && _a !== void 0 ? _a : panel.starred,
        showRecentlyViewed: (_b = panel.options.showRecentlyViewed) !== null && _b !== void 0 ? _b : panel.recent,
        showSearch: (_c = panel.options.showSearch) !== null && _c !== void 0 ? _c : panel.search,
        showHeadings: (_d = panel.options.showHeadings) !== null && _d !== void 0 ? _d : panel.headings,
        maxItems: (_e = panel.options.maxItems) !== null && _e !== void 0 ? _e : panel.limit,
        query: (_f = panel.options.query) !== null && _f !== void 0 ? _f : panel.query,
        folderId: (_g = panel.options.folderId) !== null && _g !== void 0 ? _g : panel.folderId,
        tags: (_h = panel.options.tags) !== null && _h !== void 0 ? _h : panel.tags,
    };
    var previousVersion = parseFloat(panel.pluginVersion || '6.1');
    if (previousVersion < 6.3) {
        var oldProps = ['starred', 'recent', 'search', 'headings', 'limit', 'query', 'folderId'];
        oldProps.forEach(function (prop) { return delete panel[prop]; });
    }
    return newOptions;
})
    .setSuggestionsSupplier(new DashListSuggestionsSupplier());
//# sourceMappingURL=module.js.map