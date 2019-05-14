import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
// Services & Utils
import { getBackendSrv } from 'app/core/services/backend_srv';
// Components
import { FormLabel, Select } from '@grafana/ui';
var QueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(QueryEditor, _super);
    function QueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.backendSrv = getBackendSrv();
        _this.state = {
            scenarioList: [],
            current: null,
        };
        _this.onScenarioChange = function (item) {
            _this.props.onChange(tslib_1.__assign({}, _this.props.query, { scenarioId: item.value }));
        };
        return _this;
    }
    QueryEditor.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, query, datasource, scenarioList, current;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, query = _a.query, datasource = _a.datasource;
                        query.scenarioId = query.scenarioId || 'random_walk';
                        return [4 /*yield*/, datasource.getScenarios()];
                    case 1:
                        scenarioList = _b.sent();
                        current = _.find(scenarioList, { id: query.scenarioId });
                        this.setState({ scenarioList: scenarioList, current: current });
                        return [2 /*return*/];
                }
            });
        });
    };
    QueryEditor.prototype.render = function () {
        var query = this.props.query;
        var options = this.state.scenarioList.map(function (item) { return ({ label: item.name, value: item.id }); });
        var current = options.find(function (item) { return item.value === query.scenarioId; });
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormLabel, { className: "query-keyword", width: 7 }, "Scenario"),
                React.createElement(Select, { options: options, value: current, onChange: this.onScenarioChange }))));
    };
    return QueryEditor;
}(PureComponent));
export { QueryEditor };
//# sourceMappingURL=QueryEditor.js.map