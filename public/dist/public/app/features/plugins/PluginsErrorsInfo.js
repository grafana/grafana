import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, InfoBox, List, PluginSignatureBadge, useTheme } from '@grafana/ui';
import { getAllPluginsErrors } from './state/selectors';
import { loadPlugins, loadPluginsErrors } from './state/actions';
import useAsync from 'react-use/lib/useAsync';
import { connect } from 'react-redux';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { css } from '@emotion/css';
var mapStateToProps = function (state) { return ({
    errors: getAllPluginsErrors(state.plugins),
}); };
var mapDispatchToProps = {
    loadPluginsErrors: loadPluginsErrors,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var PluginsErrorsInfoUnconnected = function (_a) {
    var loadPluginsErrors = _a.loadPluginsErrors, errors = _a.errors, children = _a.children;
    var theme = useTheme();
    var loading = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadPluginsErrors()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [loadPlugins]).loading;
    if (loading || errors.length === 0) {
        return null;
    }
    return (React.createElement(InfoBox, { "aria-label": selectors.pages.PluginsList.signatureErrorNotice, severity: "warning", urlTitle: "Read more about plugin signing", url: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" },
        React.createElement("div", null,
            React.createElement("p", null, "Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these plugins. We recommend only using signed plugins."),
            "The following plugins are disabled and not shown in the list below:",
            React.createElement(List, { items: errors, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            list-style-type: circle;\n          "], ["\n            list-style-type: circle;\n          "]))), renderItem: function (e) { return (React.createElement("div", { className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n                margin-top: ", ";\n              "], ["\n                margin-top: ", ";\n              "])), theme.spacing.sm) },
                    React.createElement(HorizontalGroup, { spacing: "sm", justify: "flex-start", align: "center" },
                        React.createElement("strong", null, e.pluginId),
                        React.createElement(PluginSignatureBadge, { status: mapPluginErrorCodeToSignatureStatus(e.errorCode), className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n                    margin-top: 0;\n                  "], ["\n                    margin-top: 0;\n                  "]))) })))); } }),
            children)));
};
export var PluginsErrorsInfo = connect(mapStateToProps, mapDispatchToProps)(PluginsErrorsInfoUnconnected);
function mapPluginErrorCodeToSignatureStatus(code) {
    switch (code) {
        case PluginErrorCode.invalidSignature:
            return PluginSignatureStatus.invalid;
        case PluginErrorCode.missingSignature:
            return PluginSignatureStatus.missing;
        case PluginErrorCode.modifiedSignature:
            return PluginSignatureStatus.modified;
        default:
            return PluginSignatureStatus.missing;
    }
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PluginsErrorsInfo.js.map