import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { Field, useStyles2 } from '@grafana/ui';
import { LibraryPanelInputState } from '../state/reducers';
import { css } from '@emotion/css';
import { LibraryPanelCard } from '../../library-panels/components/LibraryPanelCard/LibraryPanelCard';
export function ImportDashboardLibraryPanelsList(_a) {
    var inputs = _a.inputs, label = _a.label, description = _a.description, folderName = _a.folderName;
    var styles = useStyles2(getStyles);
    if (!Boolean(inputs === null || inputs === void 0 ? void 0 : inputs.length)) {
        return null;
    }
    return (React.createElement("div", { className: styles.spacer },
        React.createElement(Field, { label: label, description: description },
            React.createElement(React.Fragment, null, inputs.map(function (input, index) {
                var libraryPanelIndex = "elements[" + index + "]";
                var libraryPanel = input.state === LibraryPanelInputState.New
                    ? __assign(__assign({}, input.model), { meta: __assign(__assign({}, input.model.meta), { folderName: folderName !== null && folderName !== void 0 ? folderName : 'General' }) }) : __assign({}, input.model);
                return (React.createElement("div", { className: styles.item, key: libraryPanelIndex },
                    React.createElement(LibraryPanelCard, { libraryPanel: libraryPanel, onClick: function () { return undefined; } })));
            })))));
}
function getStyles(theme) {
    return {
        spacer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(2)),
        item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(1)),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=ImportDashboardLibraryPanelsList.js.map