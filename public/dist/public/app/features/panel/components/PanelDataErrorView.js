import { css } from '@emotion/css';
import React from 'react';
import { CoreApp, VisualizationSuggestionsBuilder, } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { CardButton } from 'app/core/components/CardButton';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { toggleVizPicker } from 'app/features/dashboard/components/PanelEditor/state/reducers';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { useDispatch } from 'app/types';
import { changePanelPlugin } from '../state/actions';
export function PanelDataErrorView(props) {
    var _a;
    const styles = useStyles2(getStyles);
    const context = usePanelContext();
    const builder = new VisualizationSuggestionsBuilder(props.data);
    const { dataSummary } = builder;
    const message = getMessageFor(props, dataSummary);
    const dispatch = useDispatch();
    const panel = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.getPanelById(props.panelId);
    const openVizPicker = () => {
        store.setObject(LS_VISUALIZATION_SELECT_TAB_KEY, VisualizationSelectPaneTab.Suggestions);
        dispatch(toggleVizPicker(true));
    };
    const switchToTable = () => {
        if (!panel) {
            return;
        }
        dispatch(changePanelPlugin({
            panel,
            pluginId: 'table',
        }));
    };
    const loadSuggestion = (s) => {
        if (!panel) {
            return;
        }
        dispatch(changePanelPlugin(Object.assign(Object.assign({}, s), { // includes panelId, config, etc
            panel })));
        if (s.transformations) {
            setTimeout(() => {
                locationService.partial({ tab: 'transform' });
            }, 100);
        }
    };
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.message }, message),
        context.app === CoreApp.PanelEditor && dataSummary.hasData && panel && (React.createElement("div", { className: styles.actions },
            props.suggestions && (React.createElement(React.Fragment, null, props.suggestions.map((v) => (React.createElement(CardButton, { key: v.name, icon: "process", onClick: () => loadSuggestion(v) }, v.name))))),
            React.createElement(CardButton, { icon: "table", onClick: switchToTable }, "Switch to table"),
            React.createElement(CardButton, { icon: "chart-line", onClick: openVizPicker }, "Open visualization suggestions")))));
}
function getMessageFor({ data, fieldConfig, message, needsNumberField, needsTimeField, needsStringField }, dataSummary) {
    var _a;
    if (message) {
        return message;
    }
    if (!data.series || data.series.length === 0 || data.series.every((frame) => frame.length === 0)) {
        return (_a = fieldConfig === null || fieldConfig === void 0 ? void 0 : fieldConfig.defaults.noValue) !== null && _a !== void 0 ? _a : 'No data';
    }
    if (needsStringField && !dataSummary.hasStringField) {
        return 'Data is missing a string field';
    }
    if (needsNumberField && !dataSummary.hasNumberField) {
        return 'Data is missing a number field';
    }
    if (needsTimeField && !dataSummary.hasTimeField) {
        return 'Data is missing a time field';
    }
    return 'Cannot visualize data';
}
const getStyles = (theme) => {
    return {
        wrapper: css({
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
        }),
        message: css({
            textAlign: 'center',
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.lg,
            width: '100%',
        }),
        actions: css({
            marginTop: theme.spacing(2),
            display: 'flex',
            height: '50%',
            maxHeight: '150px',
            columnGap: theme.spacing(1),
            rowGap: theme.spacing(1),
            width: '100%',
            maxWidth: '600px',
        }),
    };
};
//# sourceMappingURL=PanelDataErrorView.js.map