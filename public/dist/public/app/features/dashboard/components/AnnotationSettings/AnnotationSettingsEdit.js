import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { getDataSourceRef, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, Checkbox, Field, FieldSet, HorizontalGroup, Input, MultiSelect, Select, useStyles2, } from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import config from 'app/core/config';
import StandardAnnotationQueryEditor from 'app/features/annotations/components/StandardAnnotationQueryEditor';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { AngularEditorLoader } from './AngularEditorLoader';
export const newAnnotationName = 'New annotation';
export const AnnotationSettingsEdit = ({ editIdx, dashboard }) => {
    const styles = useStyles2(getStyles);
    const [annotation, setAnnotation] = useState(dashboard.annotations.list[editIdx]);
    const panelFilter = useMemo(() => {
        if (!annotation.filter) {
            return PanelFilterType.AllPanels;
        }
        return annotation.filter.exclude ? PanelFilterType.ExcludePanels : PanelFilterType.IncludePanels;
    }, [annotation.filter]);
    const { value: ds } = useAsync(() => {
        return getDataSourceSrv().get(annotation.datasource);
    }, [annotation.datasource]);
    const dsi = getDataSourceSrv().getInstanceSettings(annotation.datasource);
    const onUpdate = (annotation) => {
        const list = [...dashboard.annotations.list];
        list.splice(editIdx, 1, annotation);
        setAnnotation(annotation);
        dashboard.annotations.list = list;
    };
    const onNameChange = (ev) => {
        onUpdate(Object.assign(Object.assign({}, annotation), { name: ev.currentTarget.value }));
    };
    const onDataSourceChange = (ds) => {
        onUpdate(Object.assign(Object.assign({}, annotation), { datasource: getDataSourceRef(ds) }));
    };
    const onChange = (ev) => {
        const target = ev.currentTarget;
        onUpdate(Object.assign(Object.assign({}, annotation), { [target.name]: target.type === 'checkbox' ? target.checked : target.value }));
    };
    const onColorChange = (color) => {
        onUpdate(Object.assign(Object.assign({}, annotation), { iconColor: color }));
    };
    const onFilterTypeChange = (v) => {
        var _a, _b;
        let filter = v.value === PanelFilterType.AllPanels
            ? undefined
            : {
                exclude: v.value === PanelFilterType.ExcludePanels,
                ids: (_b = (_a = annotation.filter) === null || _a === void 0 ? void 0 : _a.ids) !== null && _b !== void 0 ? _b : [],
            };
        onUpdate(Object.assign(Object.assign({}, annotation), { filter }));
    };
    const onAddFilterPanelID = (selections) => {
        if (!Array.isArray(selections)) {
            return;
        }
        const filter = {
            exclude: panelFilter === PanelFilterType.ExcludePanels,
            ids: [],
        };
        selections.forEach((selection) => selection.value && filter.ids.push(selection.value));
        onUpdate(Object.assign(Object.assign({}, annotation), { filter }));
    };
    const onApply = goBackToList;
    const onPreview = () => {
        locationService.partial({ editview: null, editIndex: null });
    };
    const onDelete = () => {
        const annotations = dashboard.annotations.list;
        dashboard.annotations.list = [...annotations.slice(0, editIdx), ...annotations.slice(editIdx + 1)];
        goBackToList();
    };
    const isNewAnnotation = annotation.name === newAnnotationName;
    const sortFn = (a, b) => {
        if (a.label && b.label) {
            return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
        }
        return -1;
    };
    const panels = useMemo(() => {
        var _a;
        return (_a = dashboard === null || dashboard === void 0 ? void 0 : dashboard.panels.filter((panel) => config.panels[panel.type]).map((panel) => {
            var _a;
            return ({
                value: panel.id,
                label: (_a = panel.title) !== null && _a !== void 0 ? _a : `Panel ${panel.id}`,
                description: panel.description,
                imgUrl: config.panels[panel.type].info.logos.small,
            });
        }).sort(sortFn)) !== null && _a !== void 0 ? _a : [];
    }, [dashboard]);
    return (React.createElement("div", null,
        React.createElement(FieldSet, { className: styles.settingsForm },
            React.createElement(Field, { label: "Name" },
                React.createElement(Input, { "aria-label": selectors.pages.Dashboard.Settings.Annotations.Settings.name, name: "name", id: "name", autoFocus: isNewAnnotation, value: annotation.name, onChange: onNameChange })),
            React.createElement(Field, { label: "Data source", htmlFor: "data-source-picker" },
                React.createElement(DataSourcePicker, { annotations: true, variables: true, current: annotation.datasource, onChange: onDataSourceChange })),
            React.createElement(Field, { label: "Enabled", description: "When enabled the annotation query is issued every dashboard refresh" },
                React.createElement(Checkbox, { name: "enable", id: "enable", value: annotation.enable, onChange: onChange })),
            React.createElement(Field, { label: "Hidden", description: "Annotation queries can be toggled on or off at the top of the dashboard. With this option checked this toggle will be hidden." },
                React.createElement(Checkbox, { name: "hide", id: "hide", value: annotation.hide, onChange: onChange })),
            React.createElement(Field, { label: "Color", description: "Color to use for the annotation event markers" },
                React.createElement(HorizontalGroup, null,
                    React.createElement(ColorValueEditor, { value: annotation === null || annotation === void 0 ? void 0 : annotation.iconColor, onChange: onColorChange }))),
            React.createElement(Field, { label: "Show in", "aria-label": selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel },
                React.createElement(React.Fragment, null,
                    React.createElement(Select, { options: panelFilters, value: panelFilter, onChange: onFilterTypeChange, "aria-label": selectors.components.Annotations.annotationsTypeInput }),
                    panelFilter !== PanelFilterType.AllPanels && (React.createElement(MultiSelect, { options: panels, value: panels.filter((panel) => { var _a; return (_a = annotation.filter) === null || _a === void 0 ? void 0 : _a.ids.includes(panel.value); }), onChange: onAddFilterPanelID, isClearable: true, placeholder: "Choose panels", width: 100, closeMenuOnSelect: false, className: styles.select, "aria-label": selectors.components.Annotations.annotationsChoosePanelInput }))))),
        React.createElement(FieldSet, null,
            React.createElement("h3", { className: "page-heading" }, "Query"),
            (ds === null || ds === void 0 ? void 0 : ds.annotations) && dsi && (React.createElement(StandardAnnotationQueryEditor, { datasource: ds, datasourceInstanceSettings: dsi, annotation: annotation, onChange: onUpdate })),
            ds && !ds.annotations && React.createElement(AngularEditorLoader, { datasource: ds, annotation: annotation, onChange: onUpdate })),
        React.createElement(Stack, null,
            !annotation.builtIn && (React.createElement(Button, { variant: "destructive", onClick: onDelete }, "Delete")),
            React.createElement(Button, { variant: "secondary", onClick: onPreview, "data-testid": selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.previewInDashboard }, "Preview in dashboard"),
            React.createElement(Button, { variant: "primary", onClick: onApply }, "Apply"))));
};
const getStyles = (theme) => {
    return {
        settingsForm: css({
            maxWidth: theme.spacing(60),
            marginBottom: theme.spacing(2),
        }),
        select: css `
      margin-top: 8px;
    `,
    };
};
function goBackToList() {
    locationService.partial({ editIndex: null });
}
// Synthetic type
var PanelFilterType;
(function (PanelFilterType) {
    PanelFilterType[PanelFilterType["AllPanels"] = 0] = "AllPanels";
    PanelFilterType[PanelFilterType["IncludePanels"] = 1] = "IncludePanels";
    PanelFilterType[PanelFilterType["ExcludePanels"] = 2] = "ExcludePanels";
})(PanelFilterType || (PanelFilterType = {}));
const panelFilters = [
    {
        label: 'All panels',
        value: PanelFilterType.AllPanels,
        description: 'Send the annotation data to all panels that support annotations',
    },
    {
        label: 'Selected panels',
        value: PanelFilterType.IncludePanels,
        description: 'Send the annotations to the explicitly listed panels',
    },
    {
        label: 'All panels except',
        value: PanelFilterType.ExcludePanels,
        description: 'Do not send annotation data to the following panels',
    },
];
//# sourceMappingURL=AnnotationSettingsEdit.js.map