import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { pick } from 'lodash';
import { ExploreMode } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { QueryInlineField } from './';
import { MetricsQueryEditor } from './MetricsQueryEditor';
import LogsQueryEditor from './LogsQueryEditor';
var apiModes = {
    Metrics: { label: 'CloudWatch Metrics', value: 'Metrics' },
    Logs: { label: 'CloudWatch Logs', value: 'Logs' },
};
var PanelQueryEditor = /** @class */ (function (_super) {
    __extends(PanelQueryEditor, _super);
    function PanelQueryEditor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelQueryEditor.prototype.render = function () {
        var _this = this;
        var _a;
        var query = this.props.query;
        var apiMode = (_a = query.queryMode) !== null && _a !== void 0 ? _a : 'Metrics';
        return (React.createElement(React.Fragment, null,
            React.createElement(QueryInlineField, { label: "Query Mode" },
                React.createElement(Segment, { value: apiModes[apiMode], options: Object.values(apiModes), onChange: function (_a) {
                        var _b;
                        var value = _a.value;
                        var newMode = (_b = value) !== null && _b !== void 0 ? _b : 'Metrics';
                        if (newMode !== apiModes[apiMode].value) {
                            var commonProps = pick(query, 'id', 'region', 'namespace', 'refId', 'hide', 'key', 'queryType', 'datasource');
                            _this.props.onChange(__assign(__assign({}, commonProps), { queryMode: newMode }));
                        }
                    } })),
            apiMode === ExploreMode.Logs ? (React.createElement(LogsQueryEditor, __assign({}, this.props, { allowCustomValue: true }))) : (React.createElement(MetricsQueryEditor, __assign({}, this.props)))));
    };
    return PanelQueryEditor;
}(PureComponent));
export { PanelQueryEditor };
//# sourceMappingURL=PanelQueryEditor.js.map