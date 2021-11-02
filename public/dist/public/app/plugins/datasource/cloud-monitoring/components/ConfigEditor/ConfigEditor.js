import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Select, FieldSet, InlineField, Alert } from '@grafana/ui';
import { onUpdateDatasourceJsonDataOptionSelect } from '@grafana/data';
import { AuthType, authTypes } from '../../types';
import { JWTConfig } from './JWTConfig';
var ConfigEditor = /** @class */ (function (_super) {
    __extends(ConfigEditor, _super);
    function ConfigEditor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ConfigEditor.prototype.render = function () {
        var _a = this.props, options = _a.options, onOptionsChange = _a.onOptionsChange;
        var secureJsonFields = options.secureJsonFields, jsonData = options.jsonData;
        if (!jsonData.hasOwnProperty('authenticationType')) {
            jsonData.authenticationType = AuthType.JWT;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "grafana-info-box" },
                    React.createElement("h4", null, "Google Cloud Monitoring Authentication"),
                    React.createElement("p", null, "There are two ways to authenticate the Google Cloud Monitoring plugin - either by uploading a Service Account key file or by automatically retrieving credentials from the Google metadata server. The latter option is only available when running Grafana on a GCE virtual machine."),
                    React.createElement("h5", null, "Uploading a Service Account Key File"),
                    React.createElement("p", null, "There are two ways to authenticate the Google Cloud Monitoring plugin. You can upload a Service Account key file or automatically retrieve credentials from the Google metadata server. The latter option is only available when running Grafana on a GCE virtual machine."),
                    React.createElement("p", null,
                        "The ",
                        React.createElement("strong", null, "Monitoring Viewer"),
                        " role provides all the permissions that Grafana needs. The following API needs to be enabled on GCP for the data source to work:",
                        ' ',
                        React.createElement("a", { className: "external-link", target: "_blank", rel: "noopener noreferrer", href: "https://console.cloud.google.com/apis/library/monitoring.googleapis.com" }, "Monitoring API")),
                    React.createElement("h5", null, "GCE Default Service Account"),
                    React.createElement("p", null, "If Grafana is running on a Google Compute Engine (GCE) virtual machine, it is possible for Grafana to automatically retrieve the default project id and authentication token from the metadata server. In order for this to work, you need to make sure that you have a service account that is setup as the default account for the virtual machine and that the service account has been given read access to the Google Cloud Monitoring Monitoring API."),
                    React.createElement("p", null,
                        "Detailed instructions on how to create a Service Account can be found",
                        ' ',
                        React.createElement("a", { className: "external-link", target: "_blank", rel: "noopener noreferrer", href: "https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/" }, "in the documentation.")))),
            React.createElement(FieldSet, null,
                React.createElement(InlineField, { label: "Authentication type", labelWidth: 20 },
                    React.createElement(Select, { menuShouldPortal: true, width: 40, value: authTypes.find(function (x) { return x.value === jsonData.authenticationType; }) || authTypes[0], options: authTypes, defaultValue: jsonData.authenticationType, onChange: onUpdateDatasourceJsonDataOptionSelect(this.props, 'authenticationType') })),
                jsonData.authenticationType === AuthType.JWT && (React.createElement(JWTConfig, { isConfigured: secureJsonFields && !!secureJsonFields.jwt, onChange: function (_a) {
                        var private_key = _a.private_key, client_email = _a.client_email, project_id = _a.project_id, token_uri = _a.token_uri;
                        onOptionsChange(__assign(__assign({}, options), { secureJsonData: __assign(__assign({}, options.secureJsonData), { privateKey: private_key }), jsonData: __assign(__assign({}, options.jsonData), { defaultProject: project_id, clientEmail: client_email, tokenUri: token_uri }) }));
                    } }))),
            jsonData.authenticationType === AuthType.GCE && (React.createElement(Alert, { title: "", severity: "info" }, "Verify GCE default service account by clicking Save & Test"))));
    };
    return ConfigEditor;
}(PureComponent));
export { ConfigEditor };
//# sourceMappingURL=ConfigEditor.js.map