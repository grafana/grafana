import { __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { debounce } from 'lodash';
import { css } from '@emotion/css';
import { readCSV } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { TextArea } from '../TextArea/TextArea';
import { stylesFactory, withTheme } from '../../themes';
/**
 * Expects the container div to have size set and will fill it 100%
 */
var UnThemedTableInputCSV = /** @class */ (function (_super) {
    __extends(UnThemedTableInputCSV, _super);
    function UnThemedTableInputCSV(props) {
        var _this = _super.call(this, props) || this;
        _this.readCSV = debounce(function () {
            var config = _this.props.config;
            var text = _this.state.text;
            _this.setState({ data: readCSV(text, { config: config }) });
        }, 150);
        _this.onTextChange = function (event) {
            _this.setState({ text: event.target.value });
        };
        var text = props.text, config = props.config;
        _this.state = {
            text: text,
            data: readCSV(text, { config: config }),
        };
        return _this;
    }
    UnThemedTableInputCSV.prototype.componentDidUpdate = function (prevProps, prevState) {
        var text = this.state.text;
        if (text !== prevState.text || this.props.config !== prevProps.config) {
            this.readCSV();
        }
        // If the props text has changed, replace our local version
        if (this.props.text !== prevProps.text && this.props.text !== text) {
            this.setState({ text: this.props.text });
        }
        if (this.state.data !== prevState.data) {
            this.props.onSeriesParsed(this.state.data, this.state.text);
        }
    };
    UnThemedTableInputCSV.prototype.render = function () {
        var _a = this.props, width = _a.width, height = _a.height, theme = _a.theme;
        var data = this.state.data;
        var styles = getStyles(theme);
        return (React.createElement("div", { className: styles.tableInputCsv },
            React.createElement(TextArea, { style: { width: width, height: height }, placeholder: "Enter CSV here...", value: this.state.text, onChange: this.onTextChange, className: styles.textarea }),
            data && (React.createElement("footer", { className: styles.footer }, data.map(function (frame, index) {
                return (React.createElement("span", { key: index },
                    "Rows:",
                    frame.length,
                    ", Columns:",
                    frame.fields.length,
                    " \u00A0",
                    React.createElement(Icon, { name: "check-circle" })));
            })))));
    };
    return UnThemedTableInputCSV;
}(React.PureComponent));
export { UnThemedTableInputCSV };
export var TableInputCSV = withTheme(UnThemedTableInputCSV);
TableInputCSV.displayName = 'TableInputCSV';
var getStyles = stylesFactory(function (theme) {
    return {
        tableInputCsv: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n    "], ["\n      position: relative;\n    "]))),
        textarea: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      height: 100%;\n      width: 100%;\n    "], ["\n      height: 100%;\n      width: 100%;\n    "]))),
        footer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      position: absolute;\n      bottom: 15px;\n      right: 15px;\n      border: 1px solid #222;\n      background: ", ";\n      padding: 1px ", ";\n      font-size: 80%;\n    "], ["\n      position: absolute;\n      bottom: 15px;\n      right: 15px;\n      border: 1px solid #222;\n      background: ", ";\n      padding: 1px ", ";\n      font-size: 80%;\n    "])), theme.palette.online, theme.spacing.xs),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TableInputCSV.js.map