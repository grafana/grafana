import { __extends, __makeTemplateObject } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { renderMarkdown, textUtil } from '@grafana/data';
// Utils
import config from 'app/core/config';
// Types
import { TextMode } from './models.gen';
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
var TextPanel = /** @class */ (function (_super) {
    __extends(TextPanel, _super);
    function TextPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.updateHTML = debounce(function () {
            var html = _this.processContent(_this.props.options);
            if (html !== _this.state.html) {
                _this.setState({ html: html });
            }
        }, 150);
        _this.state = {
            html: _this.processContent(props.options),
        };
        return _this;
    }
    TextPanel.prototype.componentDidUpdate = function (prevProps) {
        // Since any change could be referenced in a template variable,
        // This needs to process every time (with debounce)
        this.updateHTML();
    };
    TextPanel.prototype.prepareHTML = function (html) {
        return this.interpolateAndSanitizeString(html);
    };
    TextPanel.prototype.prepareMarkdown = function (content) {
        // Sanitize is disabled here as we handle that after variable interpolation
        return renderMarkdown(this.interpolateAndSanitizeString(content), { noSanitize: config.disableSanitizeHtml });
    };
    TextPanel.prototype.interpolateAndSanitizeString = function (content) {
        var replaceVariables = this.props.replaceVariables;
        content = replaceVariables(content, {}, 'html');
        return config.disableSanitizeHtml ? content : textUtil.sanitize(content);
    };
    TextPanel.prototype.processContent = function (options) {
        var mode = options.mode, content = options.content;
        if (!content) {
            return '';
        }
        if (mode === TextMode.HTML) {
            return this.prepareHTML(content);
        }
        return this.prepareMarkdown(content);
    };
    TextPanel.prototype.render = function () {
        var html = this.state.html;
        var styles = getStyles();
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            React.createElement(DangerouslySetHtmlContent, { html: html, className: cx('markdown-html', styles.content) })));
    };
    return TextPanel;
}(PureComponent));
export { TextPanel };
var getStyles = stylesFactory(function () {
    return {
        content: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 100%;\n    "], ["\n      height: 100%;\n    "]))),
    };
});
var templateObject_1;
//# sourceMappingURL=TextPanel.js.map