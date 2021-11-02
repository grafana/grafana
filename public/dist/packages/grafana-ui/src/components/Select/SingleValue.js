import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { components } from 'react-select';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { useStyles2 } from '../../themes';
import { SlideOutTransition } from '../transitions/SlideOutTransition';
import { FadeTransition } from '../transitions/FadeTransition';
import { Spinner } from '../Spinner/Spinner';
import tinycolor from 'tinycolor2';
var getStyles = function (theme) {
    var singleValue = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: singleValue;\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    box-sizing: border-box;\n    max-width: 100%;\n  "], ["\n    label: singleValue;\n    color: ", ";\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    box-sizing: border-box;\n    max-width: 100%;\n  "])), theme.components.input.text);
    var container = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 16px;\n    height: 16px;\n    display: inline-block;\n    margin-right: 10px;\n    position: relative;\n    vertical-align: middle;\n    overflow: hidden;\n  "], ["\n    width: 16px;\n    height: 16px;\n    display: inline-block;\n    margin-right: 10px;\n    position: relative;\n    vertical-align: middle;\n    overflow: hidden;\n  "])));
    var item = css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 100%;\n    height: 100%;\n    position: absolute;\n  "], ["\n    width: 100%;\n    height: 100%;\n    position: absolute;\n  "])));
    var disabled = css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), tinycolor(theme.colors.text.disabled).setAlpha(0.64).toString());
    return { singleValue: singleValue, container: container, item: item, disabled: disabled };
};
export var SingleValue = function (props) {
    var children = props.children, data = props.data, disabled = props.disabled;
    var styles = useStyles2(getStyles);
    var loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });
    return (React.createElement(components.SingleValue, __assign({}, props),
        React.createElement("div", { className: cx(styles.singleValue, disabled && styles.disabled) },
            data.imgUrl ? (React.createElement(FadeWithImage, { loading: loading, imgUrl: data.imgUrl, styles: styles, alt: data.label || data.value })) : (React.createElement(SlideOutTransition, { horizontal: true, size: 16, visible: loading, duration: 150 },
                React.createElement("div", { className: styles.container },
                    React.createElement(Spinner, { className: styles.item, inline: true })))),
            !data.hideText && children)));
};
var FadeWithImage = function (props) {
    return (React.createElement("div", { className: props.styles.container },
        React.createElement(FadeTransition, { duration: 150, visible: props.loading },
            React.createElement(Spinner, { className: props.styles.item, inline: true })),
        React.createElement(FadeTransition, { duration: 150, visible: !props.loading },
            React.createElement("img", { className: props.styles.item, src: props.imgUrl, alt: props.alt }))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=SingleValue.js.map