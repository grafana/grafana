import { css, cx } from '@emotion/css';
import { produce } from 'immer';
import React, { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Button, Field, Input, Text, TextArea, useStyles2 } from '@grafana/ui';
import { dashboardApi } from '../../api/dashboardApi';
import { Annotation, annotationLabels } from '../../utils/constants';
import AnnotationHeaderField from './AnnotationHeaderField';
import DashboardAnnotationField from './DashboardAnnotationField';
import { DashboardPicker, mergePanels } from './DashboardPicker';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
const AnnotationsStep = () => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const [showPanelSelector, setShowPanelSelector] = useToggle(false);
    const { control, register, watch, formState: { errors }, setValue, } = useFormContext();
    const annotations = watch('annotations');
    const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });
    const selectedDashboardUid = (_a = annotations.find((annotation) => annotation.key === Annotation.dashboardUID)) === null || _a === void 0 ? void 0 : _a.value;
    const selectedPanelId = (_b = annotations.find((annotation) => annotation.key === Annotation.panelID)) === null || _b === void 0 ? void 0 : _b.value;
    const [selectedDashboard, setSelectedDashboard] = useState(undefined);
    const [selectedPanel, setSelectedPanel] = useState(undefined);
    const { useDashboardQuery } = dashboardApi;
    const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery({ uid: selectedDashboardUid !== null && selectedDashboardUid !== void 0 ? selectedDashboardUid : '' }, { skip: !selectedDashboardUid });
    useEffect(() => {
        if (isDashboardFetching) {
            return;
        }
        setSelectedDashboard(dashboardResult === null || dashboardResult === void 0 ? void 0 : dashboardResult.dashboard);
        const allPanels = mergePanels(dashboardResult);
        const currentPanel = allPanels.find((panel) => panel.id.toString() === selectedPanelId);
        setSelectedPanel(currentPanel);
    }, [selectedPanelId, dashboardResult, isDashboardFetching]);
    const setSelectedDashboardAndPanelId = (dashboardUid, panelId) => {
        const updatedAnnotations = produce(annotations, (draft) => {
            const dashboardAnnotation = draft.find((a) => a.key === Annotation.dashboardUID);
            const panelAnnotation = draft.find((a) => a.key === Annotation.panelID);
            if (dashboardAnnotation) {
                dashboardAnnotation.value = dashboardUid;
            }
            else {
                draft.push({ key: Annotation.dashboardUID, value: dashboardUid });
            }
            if (panelAnnotation) {
                panelAnnotation.value = panelId;
            }
            else {
                draft.push({ key: Annotation.panelID, value: panelId });
            }
        });
        setValue('annotations', updatedAnnotations);
        setShowPanelSelector(false);
    };
    const handleDeleteDashboardAnnotation = () => {
        const updatedAnnotations = annotations.filter((a) => a.key !== Annotation.dashboardUID && a.key !== Annotation.panelID);
        setValue('annotations', updatedAnnotations);
        setSelectedDashboard(undefined);
        setSelectedPanel(undefined);
    };
    const handleEditDashboardAnnotation = () => {
        setShowPanelSelector(true);
    };
    function getAnnotationsSectionDescription() {
        const docsLink = 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation';
        return (React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "baseline" },
            React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Add annotations to provide more context in your alert notifications."),
            React.createElement(NeedHelpInfo, { contentText: `Annotations add metadata to provide more information on the alert in your alert notifications.
          For example, add a Summary annotation to tell you which value caused the alert to fire or which server it happened on.
          Annotations can contain a combination of text and template code.`, externalLink: docsLink, linkText: `Read about annotations`, title: "Annotations" })));
    }
    return (React.createElement(RuleEditorSection, { stepNo: 4, title: "Add annotations", description: getAnnotationsSectionDescription(), fullWidth: true },
        React.createElement(Stack, { direction: "column", gap: 1 },
            fields.map((annotationField, index) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const isUrl = (_b = (_a = annotations[index]) === null || _a === void 0 ? void 0 : _a.key) === null || _b === void 0 ? void 0 : _b.toLocaleLowerCase().endsWith('url');
                const ValueInputComponent = isUrl ? Input : TextArea;
                // eslint-disable-next-line
                const annotation = annotationField.key;
                return (React.createElement("div", { key: annotationField.id, className: styles.flexRow },
                    React.createElement("div", null,
                        React.createElement(AnnotationHeaderField, { annotationField: annotationField, annotations: annotations, annotation: annotation, index: index }),
                        selectedDashboardUid && selectedPanelId && annotationField.key === Annotation.dashboardUID && (React.createElement(DashboardAnnotationField, { dashboard: selectedDashboard, panel: selectedPanel, dashboardUid: selectedDashboardUid.toString(), panelId: selectedPanelId.toString(), onEditClick: handleEditDashboardAnnotation, onDeleteClick: handleDeleteDashboardAnnotation })),
                        React.createElement("div", { className: styles.annotationValueContainer },
                            React.createElement(Field, { hidden: annotationField.key === Annotation.dashboardUID || annotationField.key === Annotation.panelID, className: cx(styles.flexRowItemMargin, styles.field), invalid: !!((_e = (_d = (_c = errors.annotations) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.message), error: (_h = (_g = (_f = errors.annotations) === null || _f === void 0 ? void 0 : _f[index]) === null || _g === void 0 ? void 0 : _g.value) === null || _h === void 0 ? void 0 : _h.message },
                                React.createElement(ValueInputComponent, Object.assign({ "data-testid": `annotation-value-${index}`, className: cx(styles.annotationValueInput, { [styles.textarea]: !isUrl }) }, register(`annotations.${index}.value`), { placeholder: isUrl
                                        ? 'https://'
                                        : (annotationField.key && `Enter a ${annotationField.key}...`) ||
                                            'Enter custom annotation content...', defaultValue: annotationField.value }))),
                            !annotationLabels[annotation] && (React.createElement(Button, { type: "button", className: styles.deleteAnnotationButton, "aria-label": "delete annotation", icon: "trash-alt", variant: "secondary", onClick: () => remove(index) }))))));
            }),
            React.createElement(Stack, { direction: "row", gap: 1 },
                React.createElement("div", { className: styles.addAnnotationsButtonContainer },
                    React.createElement(Button, { icon: "plus", type: "button", variant: "secondary", onClick: () => {
                            append({ key: '', value: '' });
                        } }, "Add custom annotation"),
                    !selectedDashboard && (React.createElement(Button, { type: "button", variant: "secondary", icon: "dashboard", onClick: () => setShowPanelSelector(true) }, "Link dashboard and panel")))),
            showPanelSelector && (React.createElement(DashboardPicker, { isOpen: true, dashboardUid: selectedDashboardUid, panelId: selectedPanelId, onChange: setSelectedDashboardAndPanelId, onDismiss: () => setShowPanelSelector(false) })))));
};
const getStyles = (theme) => ({
    annotationValueInput: css `
    width: 394px;
  `,
    textarea: css `
    height: 76px;
  `,
    addAnnotationsButtonContainer: css `
    margin-top: ${theme.spacing(1)};
    gap: ${theme.spacing(1)};
    display: flex;
  `,
    field: css `
    margin-bottom: ${theme.spacing(0.5)};
  `,
    flexRow: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
    flexRowItemMargin: css `
    margin-top: ${theme.spacing(1)};
  `,
    deleteAnnotationButton: css `
    display: inline-block;
    margin-top: 10px;
    margin-left: 10px;
  `,
    annotationTitle: css `
    color: ${theme.colors.text.primary};
    margin-bottom: 3px;
  `,
    annotationContainer: css `
    margin-top: 5px;
  `,
    annotationDescription: css `
    color: ${theme.colors.text.secondary};
  `,
    annotationValueContainer: css `
    display: flex;
  `,
});
export default AnnotationsStep;
//# sourceMappingURL=AnnotationsStep.js.map