import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { stylesFactory } from '@grafana/ui';
export var getPanelInspectorStyles = stylesFactory(function () {
    return {
        wrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      flex: 1 1 0;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n      flex: 1 1 0;\n    "]))),
        toolbar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      width: 100%;\n      flex-grow: 0;\n      align-items: center;\n      justify-content: flex-end;\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      width: 100%;\n      flex-grow: 0;\n      align-items: center;\n      justify-content: flex-end;\n      margin-bottom: ", ";\n    "])), config.theme.spacing.sm),
        toolbarItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), config.theme.spacing.md),
        content: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      flex-grow: 1;\n      height: 100%;\n      padding-bottom: 16px;\n    "], ["\n      flex-grow: 1;\n      height: 100%;\n      padding-bottom: 16px;\n    "]))),
        contentQueryInspector: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      flex-grow: 1;\n      padding: ", " 0;\n    "], ["\n      flex-grow: 1;\n      padding: ", " 0;\n    "])), config.theme.spacing.md),
        editor: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      font-family: monospace;\n      height: 100%;\n      flex-grow: 1;\n    "], ["\n      font-family: monospace;\n      height: 100%;\n      flex-grow: 1;\n    "]))),
        viewer: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      overflow: scroll;\n    "], ["\n      overflow: scroll;\n    "]))),
        dataFrameSelect: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      flex-grow: 2;\n    "], ["\n      flex-grow: 2;\n    "]))),
        tabContent: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "], ["\n      height: 100%;\n      display: flex;\n      flex-direction: column;\n    "]))),
        dataTabContent: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      width: 100%;\n    "]))),
        actionsWrapper: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        leftActions: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n      display: flex;\n      flex-grow: 1;\n\n      max-width: 85%;\n      @media (max-width: 1345px) {\n        max-width: 75%;\n      }\n    "], ["\n      display: flex;\n      flex-grow: 1;\n\n      max-width: 85%;\n      @media (max-width: 1345px) {\n        max-width: 75%;\n      }\n    "]))),
        options: css(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n      padding-top: ", ";\n    "], ["\n      padding-top: ", ";\n    "])), config.theme.spacing.sm),
        dataDisplayOptions: css(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\n      flex-grow: 1;\n      min-width: 300px;\n      margin-right: ", ";\n    "], ["\n      flex-grow: 1;\n      min-width: 300px;\n      margin-right: ", ";\n    "])), config.theme.spacing.sm),
        selects: css(templateObject_15 || (templateObject_15 = __makeTemplateObject(["\n      display: flex;\n      > * {\n        margin-right: ", ";\n      }\n    "], ["\n      display: flex;\n      > * {\n        margin-right: ", ";\n      }\n    "])), config.theme.spacing.sm),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15;
//# sourceMappingURL=styles.js.map