import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback, useEffect, useRef } from 'react';
import { isNil } from 'lodash';
import classNames from 'classnames';
import { css } from '@emotion/css';
import Scrollbars from 'react-custom-scrollbars-2';
import { useStyles2 } from '../../themes';
/**
 * Wraps component into <Scrollbars> component from `react-custom-scrollbars`
 */
export var CustomScrollbar = function (_a) {
    var _b = _a.autoHide, autoHide = _b === void 0 ? false : _b, _c = _a.autoHideTimeout, autoHideTimeout = _c === void 0 ? 200 : _c, setScrollTop = _a.setScrollTop, className = _a.className, _d = _a.autoHeightMin, autoHeightMin = _d === void 0 ? '0' : _d, _e = _a.autoHeightMax, autoHeightMax = _e === void 0 ? '100%' : _e, _f = _a.hideTracksWhenNotNeeded, hideTracksWhenNotNeeded = _f === void 0 ? false : _f, hideHorizontalTrack = _a.hideHorizontalTrack, hideVerticalTrack = _a.hideVerticalTrack, updateAfterMountMs = _a.updateAfterMountMs, scrollTop = _a.scrollTop, children = _a.children;
    var ref = useRef(null);
    var styles = useStyles2(getStyles);
    var updateScroll = function () {
        if (ref.current && !isNil(scrollTop)) {
            ref.current.scrollTop(scrollTop);
        }
    };
    useEffect(function () {
        updateScroll();
    });
    /**
     * Special logic for doing a update a few milliseconds after mount to check for
     * updated height due to dynamic content
     */
    useEffect(function () {
        if (!updateAfterMountMs) {
            return;
        }
        setTimeout(function () {
            var scrollbar = ref.current;
            if (scrollbar === null || scrollbar === void 0 ? void 0 : scrollbar.update) {
                scrollbar.update();
            }
        }, updateAfterMountMs);
    }, [updateAfterMountMs]);
    function renderTrack(className, hideTrack, passedProps) {
        if (passedProps.style && hideTrack) {
            passedProps.style.display = 'none';
        }
        return React.createElement("div", __assign({}, passedProps, { className: className }));
    }
    var renderTrackHorizontal = useCallback(function (passedProps) {
        return renderTrack('track-horizontal', hideHorizontalTrack, passedProps);
    }, [hideHorizontalTrack]);
    var renderTrackVertical = useCallback(function (passedProps) {
        return renderTrack('track-vertical', hideVerticalTrack, passedProps);
    }, [hideVerticalTrack]);
    var renderThumbHorizontal = useCallback(function (passedProps) {
        return React.createElement("div", __assign({}, passedProps, { className: "thumb-horizontal" }));
    }, []);
    var renderThumbVertical = useCallback(function (passedProps) {
        return React.createElement("div", __assign({}, passedProps, { className: "thumb-vertical" }));
    }, []);
    var renderView = useCallback(function (passedProps) {
        return React.createElement("div", __assign({}, passedProps, { className: "scrollbar-view" }));
    }, []);
    var onScrollStop = useCallback(function () {
        ref.current && setScrollTop && setScrollTop(ref.current.getValues());
    }, [setScrollTop]);
    return (React.createElement(Scrollbars, { ref: ref, className: classNames(styles.customScrollbar, className), onScrollStop: onScrollStop, autoHeight: true, autoHide: autoHide, autoHideTimeout: autoHideTimeout, hideTracksWhenNotNeeded: hideTracksWhenNotNeeded, 
        // These autoHeightMin & autoHeightMax options affect firefox and chrome differently.
        // Before these where set to inherit but that caused problems with cut of legends in firefox
        autoHeightMax: autoHeightMax, autoHeightMin: autoHeightMin, renderTrackHorizontal: renderTrackHorizontal, renderTrackVertical: renderTrackVertical, renderThumbHorizontal: renderThumbHorizontal, renderThumbVertical: renderThumbVertical, renderView: renderView }, children));
};
export default CustomScrollbar;
var getStyles = function (theme) {
    return {
        customScrollbar: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      // Fix for Firefox. For some reason sometimes .view container gets a height of its content, but in order to\n      // make scroll working it should fit outer container size (scroll appears only when inner container size is\n      // greater than outer one).\n      display: flex;\n      flex-grow: 1;\n      .scrollbar-view {\n        display: flex;\n        flex-grow: 1;\n        flex-direction: column;\n      }\n      .track-vertical {\n        border-radius: ", ";\n        width: ", " !important;\n        right: 0px;\n        bottom: ", ";\n        top: ", ";\n      }\n      .track-horizontal {\n        border-radius: ", ";\n        height: ", " !important;\n        right: ", ";\n        bottom: ", ";\n        left: ", ";\n      }\n      .thumb-vertical {\n        background: ", ";\n        border-radius: ", ";\n        opacity: 0;\n      }\n      .thumb-horizontal {\n        background: ", ";\n        border-radius: ", ";\n        opacity: 0;\n      }\n      &:hover {\n        .thumb-vertical,\n        .thumb-horizontal {\n          opacity: 1;\n          transition: opacity 0.3s ease-in-out;\n        }\n      }\n    "], ["\n      // Fix for Firefox. For some reason sometimes .view container gets a height of its content, but in order to\n      // make scroll working it should fit outer container size (scroll appears only when inner container size is\n      // greater than outer one).\n      display: flex;\n      flex-grow: 1;\n      .scrollbar-view {\n        display: flex;\n        flex-grow: 1;\n        flex-direction: column;\n      }\n      .track-vertical {\n        border-radius: ", ";\n        width: ", " !important;\n        right: 0px;\n        bottom: ", ";\n        top: ", ";\n      }\n      .track-horizontal {\n        border-radius: ", ";\n        height: ", " !important;\n        right: ", ";\n        bottom: ", ";\n        left: ", ";\n      }\n      .thumb-vertical {\n        background: ", ";\n        border-radius: ", ";\n        opacity: 0;\n      }\n      .thumb-horizontal {\n        background: ", ";\n        border-radius: ", ";\n        opacity: 0;\n      }\n      &:hover {\n        .thumb-vertical,\n        .thumb-horizontal {\n          opacity: 1;\n          transition: opacity 0.3s ease-in-out;\n        }\n      }\n    "])), theme.shape.borderRadius(2), theme.spacing(1), theme.spacing(0.25), theme.spacing(0.25), theme.shape.borderRadius(2), theme.spacing(1), theme.spacing(0.25), theme.spacing(0.25), theme.spacing(0.25), theme.colors.action.focus, theme.shape.borderRadius(2), theme.colors.action.focus, theme.shape.borderRadius(2)),
    };
};
var templateObject_1;
//# sourceMappingURL=CustomScrollbar.js.map