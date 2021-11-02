import { __assign } from "tslib";
import { TextMode } from './models.gen';
export var textPanelMigrationHandler = function (panel) {
    var previousVersion = parseFloat(panel.pluginVersion || '6.1');
    var options = panel.options;
    // Migrates old Angular based text panel props to new props
    if (panel.hasOwnProperty('content') && panel.hasOwnProperty('mode')) {
        var oldTextPanel = panel;
        var content = oldTextPanel.content;
        var mode = oldTextPanel.mode;
        delete oldTextPanel.content;
        delete oldTextPanel.mode;
        if (previousVersion < 7.1) {
            options = { content: content, mode: mode };
        }
    }
    // The 'text' mode has been removed so we need to update any panels still using it to markdown
    if (options.mode !== 'html' && options.mode !== 'markdown') {
        options = __assign(__assign({}, options), { mode: TextMode.Markdown });
    }
    return options;
};
//# sourceMappingURL=textPanelMigrationHandler.js.map