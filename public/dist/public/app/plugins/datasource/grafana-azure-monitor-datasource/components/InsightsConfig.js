import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { InlineFormLabel, Button, LegacyForms, Alert } from '@grafana/ui';
var Input = LegacyForms.Input;
var InsightsConfig = /** @class */ (function (_super) {
    __extends(InsightsConfig, _super);
    function InsightsConfig() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onAppInsightsResetApiKey = function () {
            _this.props.onResetOptionKey('appInsightsApiKey');
        };
        return _this;
    }
    InsightsConfig.prototype.render = function () {
        var _a = this.props, options = _a.options, onUpdateJsonDataOption = _a.onUpdateJsonDataOption, onUpdateSecureJsonDataOption = _a.onUpdateSecureJsonDataOption;
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Azure Application Insights"),
            React.createElement(Alert, { severity: "info", title: "Application Insights credentials are deprecated" }, "Configure using Azure AD App Registration above and update existing queries to use Metrics or Logs."),
            React.createElement("div", { className: "gf-form-group" },
                options.secureJsonFields.appInsightsApiKey ? (React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineFormLabel, { className: "width-12" }, "API Key"),
                        React.createElement(Input, { className: "width-25", placeholder: "configured", disabled: true })),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("div", { className: "max-width-30 gf-form-inline" },
                            React.createElement(Button, { variant: "secondary", type: "button", onClick: this.onAppInsightsResetApiKey, disabled: this.props.options.readOnly }, "reset"))))) : (React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineFormLabel, { className: "width-12" }, "API Key"),
                        React.createElement("div", { className: "width-15" },
                            React.createElement(Input, { className: "width-30", placeholder: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", value: options.secureJsonData.appInsightsApiKey || '', onChange: onUpdateSecureJsonDataOption('appInsightsApiKey'), disabled: this.props.options.readOnly }))))),
                React.createElement("div", { className: "gf-form-inline" },
                    React.createElement("div", { className: "gf-form" },
                        React.createElement(InlineFormLabel, { className: "width-12" }, "Application ID"),
                        React.createElement("div", { className: "width-15" },
                            React.createElement(Input, { className: "width-30", value: options.jsonData.appInsightsAppId || '', onChange: onUpdateJsonDataOption('appInsightsAppId'), disabled: this.props.options.readOnly })))))));
    };
    return InsightsConfig;
}(PureComponent));
export { InsightsConfig };
export default InsightsConfig;
//# sourceMappingURL=InsightsConfig.js.map