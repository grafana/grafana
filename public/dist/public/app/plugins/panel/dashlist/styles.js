import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { styleMixins } from '@grafana/ui';
export var getStyles = function (theme) { return ({
    dashlistSectionHeader: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    color: ", ";\n  "], ["\n    margin-bottom: ", ";\n    color: ", ";\n  "])), theme.spacing(2), theme.colors.secondary.text),
    dashlistSection: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-bottom: ", ";\n    padding-top: 3px;\n  "], ["\n    margin-bottom: ", ";\n    padding-top: 3px;\n  "])), theme.spacing(2)),
    dashlistLink: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    ", "\n    display: flex;\n    cursor: pointer;\n    margin: 3px;\n    padding: 7px;\n  "], ["\n    ", "\n    display: flex;\n    cursor: pointer;\n    margin: 3px;\n    padding: 7px;\n  "])), styleMixins.listItem(theme)),
    dashlistStar: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    color: ", ";\n    cursor: pointer;\n    z-index: 1;\n  "], ["\n    display: flex;\n    align-items: center;\n    color: ", ";\n    cursor: pointer;\n    z-index: 1;\n  "])), theme.colors.secondary.text),
    dashlistFolder: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n    line-height: ", ";\n  "], ["\n    color: ", ";\n    font-size: ", ";\n    line-height: ", ";\n  "])), theme.colors.secondary.text, theme.typography.bodySmall.fontSize, theme.typography.body.lineHeight),
    dashlistTitle: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    &::after {\n      position: absolute;\n      content: '';\n      left: 0;\n      top: 0;\n      bottom: 0;\n      right: 0;\n    }\n  "], ["\n    &::after {\n      position: absolute;\n      content: '';\n      left: 0;\n      top: 0;\n      bottom: 0;\n      right: 0;\n    }\n  "]))),
    dashlistLinkBody: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    flex-grow: 1;\n  "], ["\n    flex-grow: 1;\n  "]))),
    dashlistItem: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    position: relative;\n    list-style: none;\n  "], ["\n    position: relative;\n    list-style: none;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=styles.js.map