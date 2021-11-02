import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useCallback, useRef, useState } from 'react';
import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import { Portal, useStyles2, usePanelContext } from '@grafana/ui';
import { css } from '@emotion/css';
import { AnnotationEditorForm } from './AnnotationEditorForm';
import { getCommonAnnotationStyles } from '../styles';
import { usePopper } from 'react-popper';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';
import { AnnotationTooltip } from './AnnotationTooltip';
var POPPER_CONFIG = {
    modifiers: [
        { name: 'arrow', enabled: false },
        {
            name: 'preventOverflow',
            enabled: true,
            options: {
                rootBoundary: 'viewport',
            },
        },
    ],
};
export function AnnotationMarker(_a) {
    var annotation = _a.annotation, timeZone = _a.timeZone, style = _a.style;
    var _b = usePanelContext(), canAddAnnotations = _b.canAddAnnotations, panelCtx = __rest(_b, ["canAddAnnotations"]);
    var commonStyles = useStyles2(getCommonAnnotationStyles);
    var styles = useStyles2(getStyles);
    var _c = __read(useState(false), 2), isOpen = _c[0], setIsOpen = _c[1];
    var _d = __read(useState(false), 2), isEditing = _d[0], setIsEditing = _d[1];
    var _e = __read(useState(null), 2), markerRef = _e[0], setMarkerRef = _e[1];
    var _f = __read(useState(null), 2), tooltipRef = _f[0], setTooltipRef = _f[1];
    var _g = __read(useState(null), 2), editorRef = _g[0], setEditorRef = _g[1];
    var popoverRenderTimeout = useRef();
    var popper = usePopper(markerRef, tooltipRef, POPPER_CONFIG);
    var editorPopper = usePopper(markerRef, editorRef, POPPER_CONFIG);
    var onAnnotationEdit = useCallback(function () {
        setIsEditing(true);
        setIsOpen(false);
    }, [setIsEditing, setIsOpen]);
    var onAnnotationDelete = useCallback(function () {
        if (panelCtx.onAnnotationDelete) {
            panelCtx.onAnnotationDelete(annotation.id);
        }
    }, [annotation, panelCtx]);
    var onMouseEnter = useCallback(function () {
        if (popoverRenderTimeout.current) {
            clearTimeout(popoverRenderTimeout.current);
        }
        setIsOpen(true);
    }, [setIsOpen]);
    var onPopoverMouseEnter = useCallback(function () {
        if (popoverRenderTimeout.current) {
            clearTimeout(popoverRenderTimeout.current);
        }
    }, []);
    var onMouseLeave = useCallback(function () {
        popoverRenderTimeout.current = setTimeout(function () {
            setIsOpen(false);
        }, 100);
    }, [setIsOpen]);
    var timeFormatter = useCallback(function (value) {
        return dateTimeFormat(value, {
            format: systemDateFormats.fullDate,
            timeZone: timeZone,
        });
    }, [timeZone]);
    var renderTooltip = useCallback(function () {
        return (React.createElement(AnnotationTooltip, { annotation: annotation, timeFormatter: timeFormatter, onEdit: onAnnotationEdit, onDelete: onAnnotationDelete, editable: Boolean(canAddAnnotations && canAddAnnotations()) }));
    }, [canAddAnnotations, onAnnotationDelete, onAnnotationEdit, timeFormatter, annotation]);
    var isRegionAnnotation = Boolean(annotation.isRegion);
    var marker = (React.createElement("div", { className: commonStyles(annotation).markerTriangle, style: { transform: 'translate3d(-100%,-50%, 0)' } }));
    if (isRegionAnnotation) {
        marker = (React.createElement("div", { className: commonStyles(annotation).markerBar, style: __assign(__assign({}, style), { transform: 'translate3d(0,-50%, 0)' }) }));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: setMarkerRef, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, className: !isRegionAnnotation ? styles.markerWrapper : undefined }, marker),
        isOpen && (React.createElement(Portal, null,
            React.createElement("div", __assign({ ref: setTooltipRef, style: popper.styles.popper }, popper.attributes.popper, { className: styles.tooltip, onMouseEnter: onPopoverMouseEnter, onMouseLeave: onMouseLeave }), renderTooltip()))),
        isEditing && (React.createElement(Portal, null,
            React.createElement(AnnotationEditorForm, __assign({ onDismiss: function () { return setIsEditing(false); }, onSave: function () { return setIsEditing(false); }, timeFormatter: timeFormatter, annotation: annotation, ref: setEditorRef, style: editorPopper.styles.popper }, editorPopper.attributes.popper))))));
}
var getStyles = function (theme) {
    return {
        markerWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: markerWrapper;\n      padding: 0 4px 4px 4px;\n    "], ["\n      label: markerWrapper;\n      padding: 0 4px 4px 4px;\n    "]))),
        wrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      max-width: 400px;\n    "], ["\n      max-width: 400px;\n    "]))),
        tooltip: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      ", ";\n      padding: 0;\n    "], ["\n      ", ";\n      padding: 0;\n    "])), getTooltipContainerStyles(theme)),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=AnnotationMarker.js.map