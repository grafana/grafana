import { __awaiter } from "tslib";
import { isEqual } from 'lodash';
import React, { useState, useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { firstValueFrom } from 'rxjs';
import { AppEvents, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getPanelDataFrames } from '../dashboard/components/HelpWizard/utils';
import { getPanelInspectorStyles2 } from '../inspector/styles';
import { reportPanelInspectInteraction } from '../search/page/reporting';
import { InspectTab } from './types';
import { getPrettyJSON } from './utils/utils';
var ShowContent;
(function (ShowContent) {
    ShowContent["PanelJSON"] = "panel";
    ShowContent["PanelData"] = "data";
    ShowContent["DataFrames"] = "frames";
})(ShowContent || (ShowContent = {}));
const options = [
    {
        label: t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
        description: t('dashboard.inspect-json.panel-json-description', 'The model saved in the dashboard JSON that configures how everything works.'),
        value: ShowContent.PanelJSON,
    },
    {
        label: t('dashboard.inspect-json.panel-data-label', 'Panel data'),
        description: t('dashboard.inspect-json.panel-data-description', 'The raw model passed to the panel visualization'),
        value: ShowContent.PanelData,
    },
    {
        label: t('dashboard.inspect-json.dataframe-label', 'DataFrame JSON (from Query)'),
        description: t('dashboard.inspect-json.dataframe-description', 'Raw data without transformations and field config applied. '),
        value: ShowContent.DataFrames,
    },
];
export function InspectJSONTab({ panel, dashboard, data, onClose }) {
    var _a;
    const styles = useStyles2(getPanelInspectorStyles2);
    const jsonOptions = useMemo(() => {
        var _a;
        if (panel) {
            if ((_a = panel.plugin) === null || _a === void 0 ? void 0 : _a.meta.skipDataQuery) {
                return [options[0]];
            }
            return options;
        }
        return options.slice(1, options.length);
    }, [panel]);
    const [show, setShow] = useState(panel ? ShowContent.PanelJSON : ShowContent.DataFrames);
    const [text, setText] = useState('');
    useAsync(() => __awaiter(this, void 0, void 0, function* () {
        const v = yield getJSONObject(show, panel, data);
        setText(getPrettyJSON(v));
    }), [show, panel, data]);
    const onApplyPanelModel = useCallback(() => {
        if (panel && dashboard && text) {
            try {
                if (!dashboard.meta.canEdit) {
                    appEvents.emit(AppEvents.alertError, ['Unable to apply']);
                }
                else {
                    const updates = JSON.parse(text);
                    dashboard.shouldUpdateDashboardPanelFromJSON(updates, panel);
                    //Report relevant updates
                    reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
                        panel_type_changed: panel.type !== updates.type,
                        panel_id_changed: panel.id !== updates.id,
                        panel_grid_pos_changed: !isEqual(panel.gridPos, updates.gridPos),
                        panel_targets_changed: !isEqual(panel.targets, updates.targets),
                    });
                    panel.restoreModel(updates);
                    panel.refresh();
                    appEvents.emit(AppEvents.alertSuccess, ['Panel model updated']);
                }
            }
            catch (err) {
                console.error('Error applying updates', err);
                appEvents.emit(AppEvents.alertError, ['Invalid JSON text']);
            }
            onClose();
        }
    }, [panel, dashboard, onClose, text]);
    const onShowHelpWizard = useCallback(() => {
        reportPanelInspectInteraction(InspectTab.JSON, 'supportWizard');
        const queryParms = locationService.getSearch();
        queryParms.set('inspectTab', InspectTab.Help.toString());
        locationService.push('?' + queryParms.toString());
    }, []);
    const isPanelJSON = show === ShowContent.PanelJSON;
    const canEdit = dashboard && dashboard.meta.canEdit;
    return (React.createElement("div", { className: styles.wrap },
        React.createElement("div", { className: styles.toolbar, "aria-label": selectors.components.PanelInspector.Json.content },
            React.createElement(Field, { label: t('dashboard.inspect-json.select-source', 'Select source'), className: "flex-grow-1" },
                React.createElement(Select, { inputId: "select-source-dropdown", options: jsonOptions, value: (_a = jsonOptions.find((v) => v.value === show)) !== null && _a !== void 0 ? _a : jsonOptions[0].value, onChange: (v) => setShow(v.value) })),
            panel && isPanelJSON && canEdit && (React.createElement(Button, { className: styles.toolbarItem, onClick: onApplyPanelModel }, "Apply")),
            show === ShowContent.DataFrames && (React.createElement(Button, { className: styles.toolbarItem, onClick: onShowHelpWizard }, "Support"))),
        React.createElement("div", { className: styles.content },
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement(CodeEditor, { width: "100%", height: height, language: "json", showLineNumbers: true, showMiniMap: (text && text.length) > 100, value: text || '', readOnly: !isPanelJSON, onBlur: setText }))))));
}
function getJSONObject(show, panel, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (show === ShowContent.PanelData) {
            reportPanelInspectInteraction(InspectTab.JSON, 'panelData');
            return data;
        }
        if (show === ShowContent.DataFrames) {
            reportPanelInspectInteraction(InspectTab.JSON, 'dataFrame');
            let d = data;
            // do not include transforms and
            if (panel && (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Done) {
                d = yield firstValueFrom(panel.getQueryRunner().getData({
                    withFieldConfig: false,
                    withTransforms: false,
                }));
            }
            return getPanelDataFrames(d);
        }
        if (show === ShowContent.PanelJSON && panel) {
            reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');
            return panel.getSaveModel();
        }
        return { note: t('dashboard.inspect-json.unknown', 'Unknown Object: {{show}}', { show }) };
    });
}
//# sourceMappingURL=InspectJSONTab.js.map