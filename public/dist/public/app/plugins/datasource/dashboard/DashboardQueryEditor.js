import { __assign, __awaiter, __extends, __generator, __values } from "tslib";
import React, { PureComponent } from 'react';
import { LegacyForms, VerticalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
import { SHARED_DASHBODARD_QUERY } from './types';
import config from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { DashboardQueryRow } from './DashboardQueryRow';
var Select = LegacyForms.Select;
function getQueryDisplayText(query) {
    return JSON.stringify(query);
}
var DashboardQueryEditor = /** @class */ (function (_super) {
    __extends(DashboardQueryEditor, _super);
    function DashboardQueryEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onPanelChanged = function (id) {
            var query = _this.getQuery();
            _this.props.onChange([
                __assign(__assign({}, query), { panelId: id }),
            ]);
            _this.props.onRunQueries();
        };
        _this.getPanelDescription = function (panel) {
            var defaultDatasource = _this.state.defaultDatasource;
            var dsname = panel.datasource ? panel.datasource : defaultDatasource;
            if (panel.targets.length === 1) {
                return '1 query to ' + dsname;
            }
            return panel.targets.length + ' queries to ' + dsname;
        };
        _this.state = {
            defaultDatasource: '',
            results: [],
        };
        return _this;
    }
    DashboardQueryEditor.prototype.getQuery = function () {
        return this.props.queries[0];
    };
    DashboardQueryEditor.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.updateState()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DashboardQueryEditor.prototype.componentDidUpdate = function (prevProps) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, panelData, queries;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, panelData = _a.panelData, queries = _a.queries;
                        if (!(prevProps.panelData !== panelData || prevProps.queries !== queries)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.updateState()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    DashboardQueryEditor.prototype.updateState = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var _b, panelData, queries, query, defaultDS, dashboard, panel, mainDS, info, _c, _d, query_1, ds, _e, fmt, qData, queryData, e_1_1;
            var e_1, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _b = this.props, panelData = _b.panelData, queries = _b.queries;
                        query = queries[0];
                        return [4 /*yield*/, getDatasourceSrv().get()];
                    case 1:
                        defaultDS = _g.sent();
                        dashboard = getDashboardSrv().getCurrent();
                        panel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById((_a = query.panelId) !== null && _a !== void 0 ? _a : -124134);
                        if (!panel) {
                            this.setState({ defaultDatasource: defaultDS.name });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, getDatasourceSrv().get(panel.datasource)];
                    case 2:
                        mainDS = _g.sent();
                        info = [];
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 10, 11, 12]);
                        _c = __values(panel.targets), _d = _c.next();
                        _g.label = 4;
                    case 4:
                        if (!!_d.done) return [3 /*break*/, 9];
                        query_1 = _d.value;
                        if (!query_1.datasource) return [3 /*break*/, 6];
                        return [4 /*yield*/, getDatasourceSrv().get(query_1.datasource)];
                    case 5:
                        _e = _g.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _e = mainDS;
                        _g.label = 7;
                    case 7:
                        ds = _e;
                        fmt = ds.getQueryDisplayText ? ds.getQueryDisplayText : getQueryDisplayText;
                        qData = filterPanelDataToQuery(panelData, query_1.refId);
                        queryData = qData ? qData : panelData;
                        info.push({
                            refId: query_1.refId,
                            query: fmt(query_1),
                            img: ds.meta.info.logos.small,
                            data: queryData.series,
                            error: queryData.error,
                        });
                        _g.label = 8;
                    case 8:
                        _d = _c.next();
                        return [3 /*break*/, 4];
                    case 9: return [3 /*break*/, 12];
                    case 10:
                        e_1_1 = _g.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 12];
                    case 11:
                        try {
                            if (_d && !_d.done && (_f = _c.return)) _f.call(_c);
                        }
                        finally { if (e_1) throw e_1.error; }
                        return [7 /*endfinally*/];
                    case 12:
                        this.setState({ defaultDatasource: defaultDS.name, results: info });
                        return [2 /*return*/];
                }
            });
        });
    };
    DashboardQueryEditor.prototype.renderQueryData = function (editURL) {
        var results = this.state.results;
        return (React.createElement(VerticalGroup, { spacing: "sm" }, results.map(function (target, index) {
            return React.createElement(DashboardQueryRow, { editURL: editURL, target: target, key: "DashboardQueryRow-" + index });
        })));
    };
    DashboardQueryEditor.prototype.render = function () {
        var e_2, _a;
        var _this = this;
        var dashboard = getDashboardSrv().getCurrent();
        if (!dashboard) {
            return null;
        }
        var query = this.getQuery();
        var selected;
        var panels = [];
        try {
            for (var _b = __values(dashboard.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                var plugin = config.panels[panel.type];
                if (!plugin) {
                    continue;
                }
                if (panel.targets && panel.datasource !== SHARED_DASHBODARD_QUERY) {
                    var item = {
                        value: panel.id,
                        label: panel.title ? panel.title : 'Panel ' + panel.id,
                        description: this.getPanelDescription(panel),
                        imgUrl: plugin.info.logos.small,
                    };
                    panels.push(item);
                    if (query.panelId === panel.id) {
                        selected = item;
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (panels.length < 1) {
            return (React.createElement("div", { className: css({ padding: '10px' }) }, "This dashboard does not have other panels. Add queries to other panels and try again"));
        }
        // Same as current URL, but different panelId
        var editURL = "d/" + dashboard.uid + "/" + dashboard.title + "?&editPanel=" + query.panelId;
        return (React.createElement("div", null,
            React.createElement("div", { className: "gf-form" },
                React.createElement("div", { className: "gf-form-label" }, "Use results from panel"),
                React.createElement(Select, { menuShouldPortal: true, placeholder: "Choose Panel", isSearchable: true, options: panels, value: selected, onChange: function (item) { return _this.onPanelChanged(item.value); } })),
            React.createElement("div", { className: css({ padding: '16px' }) }, query.panelId && this.renderQueryData(editURL))));
    };
    return DashboardQueryEditor;
}(PureComponent));
export { DashboardQueryEditor };
//# sourceMappingURL=DashboardQueryEditor.js.map