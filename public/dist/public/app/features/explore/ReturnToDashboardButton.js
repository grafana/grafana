import { __awaiter, __generator } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { ButtonGroup, ButtonSelect, Icon, ToolbarButton, Tooltip } from '@grafana/ui';
import { urlUtil } from '@grafana/data';
import kbn from '../../core/utils/kbn';
import config from 'app/core/config';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { setDashboardQueriesToUpdateOnLoad } from '../dashboard/state/reducers';
import { isSplit } from './state/selectors';
import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var splitted = isSplit(state);
    var _b = explore[exploreId], datasourceInstance = _b.datasourceInstance, queries = _b.queries, originPanelId = _b.originPanelId;
    var roles = ['Editor', 'Admin'];
    if (config.viewersCanEdit) {
        roles.push('Viewer');
    }
    return {
        exploreId: exploreId,
        datasourceInstance: datasourceInstance,
        queries: queries,
        originPanelId: originPanelId,
        splitted: splitted,
        canEdit: roles.some(function (r) { return contextSrv.hasRole(r); }),
    };
}
var mapDispatchToProps = {
    setDashboardQueriesToUpdateOnLoad: setDashboardQueriesToUpdateOnLoad,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var UnconnectedReturnToDashboardButton = function (_a) {
    var originPanelId = _a.originPanelId, setDashboardQueriesToUpdateOnLoad = _a.setDashboardQueriesToUpdateOnLoad, queries = _a.queries, splitted = _a.splitted, canEdit = _a.canEdit;
    var withOriginId = originPanelId && Number.isInteger(originPanelId);
    // If in split mode, or no origin id, escape early and return null
    if (splitted || !withOriginId) {
        return null;
    }
    var cleanQueries = function (queries) {
        return queries.map(function (query) {
            delete query.context;
            delete query.key;
            return query;
        });
    };
    var returnToPanel = function (_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.withChanges, withChanges = _c === void 0 ? false : _c;
        return __awaiter(void 0, void 0, void 0, function () {
            var dashboardSrv, dash, titleSlug, query;
            return __generator(this, function (_d) {
                dashboardSrv = getDashboardSrv();
                dash = dashboardSrv.getCurrent();
                if (!dash) {
                    return [2 /*return*/];
                }
                titleSlug = kbn.slugifyForUrl(dash.title);
                if (withChanges) {
                    setDashboardQueriesToUpdateOnLoad({
                        panelId: originPanelId,
                        queries: cleanQueries(queries),
                    });
                }
                query = {};
                if (withChanges || dash.panelInEdit) {
                    query.editPanel = originPanelId;
                }
                else if (dash.panelInView) {
                    query.viewPanel = originPanelId;
                }
                locationService.push(urlUtil.renderUrl("/d/" + dash.uid + "/:" + titleSlug, query));
                return [2 /*return*/];
            });
        });
    };
    return (React.createElement(ButtonGroup, null,
        React.createElement(Tooltip, { content: 'Return to panel', placement: "bottom" },
            React.createElement(ToolbarButton, { "data-testid": "returnButton", title: 'Return to panel', onClick: function () { return returnToPanel(); } },
                React.createElement(Icon, { name: "arrow-left" }))),
        canEdit && (React.createElement(ButtonSelect, { "data-testid": "returnButtonWithChanges", options: [{ label: 'Return to panel with changes', value: '' }], onChange: function () { return returnToPanel({ withChanges: true }); } }))));
};
export default connector(UnconnectedReturnToDashboardButton);
//# sourceMappingURL=ReturnToDashboardButton.js.map