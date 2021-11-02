import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
var CloudMonitoringCheatSheet = /** @class */ (function (_super) {
    __extends(CloudMonitoringCheatSheet, _super);
    function CloudMonitoringCheatSheet() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CloudMonitoringCheatSheet.prototype.render = function () {
        return (React.createElement("div", null,
            React.createElement("h2", null, "Cloud Monitoring alias patterns"),
            React.createElement("div", null,
                React.createElement("p", null, "Format the legend keys any way you want by using alias patterns. Format the legend keys any way you want by using alias patterns."),
                "Example:",
                React.createElement("code", null, "" + '{{metric.name}} - {{metric.label.instance_name}}'),
                React.createElement("br", null),
                "Result: \u00A0\u00A0",
                React.createElement("code", null, "cpu/usage_time - server1-europe-west-1"),
                React.createElement("br", null),
                React.createElement("br", null),
                React.createElement("label", null, "Patterns"),
                React.createElement("br", null),
                React.createElement("ul", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              list-style: none;\n            "], ["\n              list-style: none;\n            "]))) },
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metric.type}}'),
                        " = metric type e.g. compute.googleapis.com/instance/cpu/usage_time"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metric.name}}'),
                        " = name part of metric e.g. instance/cpu/usage_time"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metric.service}}'),
                        " = service part of metric e.g. compute"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metric.label.label_name}}'),
                        " = Metric label metadata e.g. metric.label.instance_name"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{resource.label.label_name}}'),
                        " = Resource label metadata e.g. resource.label.zone"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metadata.system_labels.name}}'),
                        " = Meta data system labels e.g. metadata.system_labels.name. For this to work, the needs to be included in the group by"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{metadata.user_labels.name}}'),
                        " = Meta data user labels e.g. metadata.user_labels.name. For this to work, the needs to be included in the group by"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{bucket}}'),
                        " = bucket boundary for distribution metrics when using a heatmap in Grafana"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{project}}'),
                        " = The project name that was specified in the query editor"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{service}}'),
                        " = The service id that was specified in the SLO query editor"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{slo}}'),
                        " = The SLO id that was specified in the SLO query editor"),
                    React.createElement("li", null,
                        React.createElement("code", null, "" + '{{selector}}'),
                        " = The Selector function that was specified in the SLO query editor")))));
    };
    return CloudMonitoringCheatSheet;
}(PureComponent));
export default CloudMonitoringCheatSheet;
var templateObject_1;
//# sourceMappingURL=CloudMonitoringCheatSheet.js.map