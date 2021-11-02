import { __read, __spreadArray, __values } from "tslib";
import { useSelector } from 'react-redux';
var SUFFIX_REGEX = /\/api\/v[1|2]\/alerts/i;
export function useExternalAmSelector() {
    var e_1, _a, e_2, _b;
    var discoveredAlertmanagers = useSelector(function (state) { var _a; return (_a = state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result) === null || _a === void 0 ? void 0 : _a.data; });
    var alertmanagerConfig = useSelector(function (state) { var _a; return (_a = state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result) === null || _a === void 0 ? void 0 : _a.alertmanagers; });
    if (!discoveredAlertmanagers || !alertmanagerConfig) {
        return;
    }
    var enabledAlertmanagers = [];
    var droppedAlertmanagers = discoveredAlertmanagers === null || discoveredAlertmanagers === void 0 ? void 0 : discoveredAlertmanagers.droppedAlertManagers.map(function (am) { return ({
        url: am.url.replace(SUFFIX_REGEX, ''),
        status: 'dropped',
        actualUrl: am.url,
    }); });
    try {
        for (var alertmanagerConfig_1 = __values(alertmanagerConfig), alertmanagerConfig_1_1 = alertmanagerConfig_1.next(); !alertmanagerConfig_1_1.done; alertmanagerConfig_1_1 = alertmanagerConfig_1.next()) {
            var url = alertmanagerConfig_1_1.value;
            if (discoveredAlertmanagers.activeAlertManagers.length === 0) {
                enabledAlertmanagers.push({
                    url: url,
                    status: 'pending',
                    actualUrl: url + "/api/v2/alerts",
                });
            }
            else {
                var found = false;
                try {
                    for (var _c = (e_2 = void 0, __values(discoveredAlertmanagers.activeAlertManagers)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var activeAM = _d.value;
                        if (activeAM.url === url + "/api/v2/alerts") {
                            found = true;
                            enabledAlertmanagers.push({
                                url: activeAM.url.replace(SUFFIX_REGEX, ''),
                                status: 'active',
                                actualUrl: activeAM.url,
                            });
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                if (!found) {
                    enabledAlertmanagers.push({
                        url: url,
                        status: 'pending',
                        actualUrl: url + "/api/v2/alerts",
                    });
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (alertmanagerConfig_1_1 && !alertmanagerConfig_1_1.done && (_a = alertmanagerConfig_1.return)) _a.call(alertmanagerConfig_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return __spreadArray(__spreadArray([], __read(enabledAlertmanagers), false), __read(droppedAlertmanagers), false);
}
//# sourceMappingURL=useExternalAmSelector.js.map