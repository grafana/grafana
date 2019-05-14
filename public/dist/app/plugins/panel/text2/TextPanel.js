import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import Remarkable from 'remarkable';
import { debounce } from 'lodash';
// Utils
import { sanitize } from 'app/core/utils/text';
import config from 'app/core/config';
var TextPanel = /** @class */ (function (_super) {
    tslib_1.__extends(TextPanel, _super);
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
        // This needs to process everytime (with debounce)
        this.updateHTML();
    };
    TextPanel.prototype.prepareHTML = function (html) {
        var replaceVariables = this.props.replaceVariables;
        html = config.disableSanitizeHtml ? html : sanitize(html);
        return replaceVariables(html);
    };
    TextPanel.prototype.prepareText = function (content) {
        return this.prepareHTML(content
            .replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/\n/g, '<br/>'));
    };
    TextPanel.prototype.prepareMarkdown = function (content) {
        if (!this.remarkable) {
            this.remarkable = new Remarkable();
        }
        return this.prepareHTML(this.remarkable.render(content));
    };
    TextPanel.prototype.processContent = function (options) {
        var mode = options.mode, content = options.content;
        if (!content) {
            return '';
        }
        if (mode === 'markdown') {
            return this.prepareMarkdown(content);
        }
        if (mode === 'html') {
            return this.prepareHTML(content);
        }
        return this.prepareText(content);
    };
    TextPanel.prototype.render = function () {
        var html = this.state.html;
        return React.createElement("div", { className: "markdown-html panel-text-content", dangerouslySetInnerHTML: { __html: html } });
    };
    return TextPanel;
}(PureComponent));
export { TextPanel };
//# sourceMappingURL=TextPanel.js.map