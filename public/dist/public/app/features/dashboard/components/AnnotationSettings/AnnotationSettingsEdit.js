import { __assign, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { Checkbox, CollapsableSection, ColorValueEditor, Field, HorizontalGroup, Input } from '@grafana/ui';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { useAsync } from 'react-use';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { AngularEditorLoader } from './AngularEditorLoader';
import { selectors } from '@grafana/e2e-selectors';
export var newAnnotation = {
    name: 'New annotation',
    enable: true,
    datasource: null,
    iconColor: 'red',
};
export var AnnotationSettingsEdit = function (_a) {
    var editIdx = _a.editIdx, dashboard = _a.dashboard;
    var _b = __read(useState(editIdx !== null ? dashboard.annotations.list[editIdx] : newAnnotation), 2), annotation = _b[0], setAnnotation = _b[1];
    var ds = useAsync(function () {
        return getDataSourceSrv().get(annotation.datasource);
    }, [annotation.datasource]).value;
    var onUpdate = function (annotation) {
        var list = __spreadArray([], __read(dashboard.annotations.list), false);
        list.splice(editIdx, 1, annotation);
        setAnnotation(annotation);
        dashboard.annotations.list = list;
    };
    var onNameChange = function (ev) {
        onUpdate(__assign(__assign({}, annotation), { name: ev.currentTarget.value }));
    };
    var onDataSourceChange = function (ds) {
        onUpdate(__assign(__assign({}, annotation), { datasource: ds.name }));
    };
    var onChange = function (ev) {
        var _a;
        var target = ev.currentTarget;
        onUpdate(__assign(__assign({}, annotation), (_a = {}, _a[target.name] = target.type === 'checkbox' ? target.checked : target.value, _a)));
    };
    var onColorChange = function (color) {
        onUpdate(__assign(__assign({}, annotation), { iconColor: color }));
    };
    var isNewAnnotation = annotation.name === newAnnotation.name;
    return (React.createElement("div", null,
        React.createElement(Field, { label: "Name" },
            React.createElement(Input, { "aria-label": selectors.pages.Dashboard.Settings.Annotations.Settings.name, name: "name", id: "name", autoFocus: isNewAnnotation, value: annotation.name, onChange: onNameChange, width: 50 })),
        React.createElement(Field, { label: "Data source", htmlFor: "data-source-picker" },
            React.createElement(DataSourcePicker, { width: 50, annotations: true, variables: true, current: annotation.datasource, onChange: onDataSourceChange })),
        React.createElement(Field, { label: "Enabled", description: "When enabled the annotation query is issued every dashboard refresh" },
            React.createElement(Checkbox, { name: "enable", id: "enable", value: annotation.enable, onChange: onChange })),
        React.createElement(Field, { label: "Hidden", description: "Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden." },
            React.createElement(Checkbox, { name: "hide", id: "hide", value: annotation.hide, onChange: onChange })),
        React.createElement(Field, { label: "Color", description: "Color to use for the annotation event markers" },
            React.createElement(HorizontalGroup, null,
                React.createElement(ColorValueEditor, { value: annotation === null || annotation === void 0 ? void 0 : annotation.iconColor, onChange: onColorChange }))),
        React.createElement(CollapsableSection, { isOpen: true, label: "Query" },
            (ds === null || ds === void 0 ? void 0 : ds.annotations) && (React.createElement(StandardAnnotationQueryEditor, { datasource: ds, annotation: annotation, onChange: onUpdate })),
            ds && !ds.annotations && React.createElement(AngularEditorLoader, { datasource: ds, annotation: annotation, onChange: onUpdate }))));
};
AnnotationSettingsEdit.displayName = 'AnnotationSettingsEdit';
//# sourceMappingURL=AnnotationSettingsEdit.js.map