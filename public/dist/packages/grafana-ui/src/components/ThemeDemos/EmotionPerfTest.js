import { __assign, __read } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "@emotion/react/jsx-runtime";
/** @jsxImportSource @emotion/react */
import { Profiler, useState } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '../../themes';
import { Button } from '../Button';
import { VerticalGroup } from '../Layout/Layout';
import classnames from 'classnames';
export function EmotionPerfTest() {
    console.log('process.env.NODE_ENV', process.env.NODE_ENV);
    return (_jsxs(VerticalGroup, { children: [_jsx("div", { children: "Emotion performance tests" }, void 0), _jsx(TestScenario, { name: "No styles", Component: NoStyles }, void 0), _jsx(TestScenario, { name: "inline emotion/css", Component: InlineEmotionCSS }, void 0), _jsx(TestScenario, { name: "useStyles no cx", Component: UseStylesNoCX }, void 0), _jsx(TestScenario, { name: "useStyles with conditional cx styles", Component: UseStylesWithConditionalCX }, void 0), _jsx(TestScenario, { name: "useStyles with css prop", Component: UseStylesWithCSSProp }, void 0), _jsx(TestScenario, { name: "useStyles with conditional css prop", Component: UseStylesWithConditionalCSS }, void 0), _jsx(TestScenario, { name: "useStyles with conditional classnames", Component: UseStylesWithConditionalClassNames }, void 0)] }, void 0));
}
export var TestScenario = function (_a) {
    var name = _a.name, Component = _a.Component;
    var _b = __read(useState(0), 2), render = _b[0], setRender = _b[1];
    return (_jsxs("div", { children: [_jsx(Button, __assign({ onClick: function () { return setRender(render > 2 ? 0 : render + 1); } }, { children: name }), void 0), render > 0 && _jsx(MeasureRender, __assign({ id: name }, { children: renderManyComponents(Component) }), void 0)] }, void 0));
};
TestScenario.displayName = 'TestScenario';
function renderManyComponents(Component) {
    var elements = [];
    for (var i = 0; i < 5000; i++) {
        elements.push(_jsx(Component, { index: i }, i.toString()));
    }
    return _jsx("div", __assign({ style: { display: 'flex', flexWrap: 'wrap' } }, { children: elements }), void 0);
}
function UseStylesNoCX(_a) {
    var index = _a.index;
    var styles = useStyles2(getStyles);
    return (_jsx("div", __assign({ className: styles.main }, { children: _jsx("div", __assign({ className: styles.child }, { children: index }), void 0) }), void 0));
}
function UseStylesWithConditionalCX(_a) {
    var _b;
    var index = _a.index;
    var styles = useStyles2(getStyles);
    var mainStyles = cx(styles.main, (_b = {}, _b[styles.large] = index > 10, _b[styles.disabed] = index % 10 === 0, _b));
    return (_jsx("div", __assign({ className: mainStyles }, { children: _jsx("div", __assign({ className: styles.child }, { children: index }), void 0) }), void 0));
}
function UseStylesWithConditionalClassNames(_a) {
    var _b;
    var index = _a.index;
    var styles = useStyles2(getStyles);
    var mainStyles = classnames(styles.main, (_b = {}, _b[styles.large] = index > 10, _b[styles.disabed] = index % 10 === 0, _b));
    return (_jsx("div", __assign({ className: mainStyles }, { children: _jsx("div", __assign({ className: styles.child }, { children: index }), void 0) }), void 0));
}
function UseStylesWithCSSProp(_a) {
    var index = _a.index;
    var styles = useStyles2(getStylesObjects);
    return (_jsx("div", __assign({ css: styles.main }, { children: _jsx("div", __assign({ css: styles.child }, { children: index }), void 0) }), void 0));
}
function UseStylesWithConditionalCSS(_a) {
    var index = _a.index;
    var styles = useStyles2(getStylesObjects);
    var mainStyles = [styles.main, index > 10 && styles.large, index % 10 === 0 && styles.disabed];
    return (_jsx("div", __assign({ css: mainStyles }, { children: _jsx("div", __assign({ css: styles.child }, { children: index }), void 0) }), void 0));
}
function InlineEmotionCSS(_a) {
    var index = _a.index;
    var theme = useTheme2();
    var styles = getStyles(theme);
    return (_jsx("div", __assign({ className: styles.main }, { children: _jsx("div", __assign({ className: styles.child }, { children: index }), void 0) }), void 0));
}
function NoStyles(_a) {
    var index = _a.index;
    return (_jsx("div", __assign({ className: "no-styles-main" }, { children: _jsx("div", __assign({ className: "no-styles-child" }, { children: index }), void 0) }), void 0));
}
function MeasureRender(_a) {
    var children = _a.children, id = _a.id;
    var onRender = function (id, phase, actualDuration, baseDuration, startTime, commitTime) {
        console.log('Profile ' + id, actualDuration);
    };
    return (_jsx(Profiler, __assign({ id: id, onRender: onRender }, { children: children }), void 0));
}
var getStyles = function (theme) {
    return {
        main: css(getStylesObjectMain(theme)),
        large: css({
            fontSize: '20px',
            color: 'red',
        }),
        disabed: css({
            fontSize: '10px',
            color: 'gray',
        }),
        child: css(getStylesObjectChild(theme)),
    };
};
var getStylesObjects = function (theme) {
    return {
        main: getStylesObjectMain(theme),
        large: {
            fontSize: '20px',
            color: 'red',
        },
        disabed: {
            fontSize: '10px',
            color: 'gray',
        },
        child: getStylesObjectChild(theme),
    };
};
function getStylesObjectMain(theme) {
    return {
        background: 'blue',
        border: '1px solid red',
        color: 'white',
        padding: theme.spacing(1),
        shadow: theme.shadows.z1,
        ':hover': {
            background: theme.colors.background.primary,
        },
    };
}
function getStylesObjectChild(theme) {
    return {
        padding: '2px',
        fontSize: '10px',
        boxShadow: 'none',
        textAlign: 'center',
        textDecoration: 'none',
    };
}
//# sourceMappingURL=EmotionPerfTest.js.map