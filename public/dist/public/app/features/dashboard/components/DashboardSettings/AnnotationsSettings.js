import { __assign, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { AnnotationSettingsEdit, AnnotationSettingsList } from '../AnnotationSettings';
import { newAnnotation } from '../AnnotationSettings/AnnotationSettingsEdit';
import { DashboardSettingsHeader } from './DashboardSettingsHeader';
export var AnnotationsSettings = function (_a) {
    var dashboard = _a.dashboard;
    var _b = __read(useState(null), 2), editIdx = _b[0], setEditIdx = _b[1];
    var onGoBack = function () {
        setEditIdx(null);
    };
    var onNew = function () {
        dashboard.annotations.list = __spreadArray(__spreadArray([], __read(dashboard.annotations.list), false), [__assign({}, newAnnotation)], false);
        setEditIdx(dashboard.annotations.list.length - 1);
    };
    var onEdit = function (idx) {
        setEditIdx(idx);
    };
    var isEditing = editIdx !== null;
    return (React.createElement(React.Fragment, null,
        React.createElement(DashboardSettingsHeader, { title: "Annotations", onGoBack: onGoBack, isEditing: isEditing }),
        !isEditing && React.createElement(AnnotationSettingsList, { dashboard: dashboard, onNew: onNew, onEdit: onEdit }),
        isEditing && React.createElement(AnnotationSettingsEdit, { dashboard: dashboard, editIdx: editIdx })));
};
//# sourceMappingURL=AnnotationsSettings.js.map