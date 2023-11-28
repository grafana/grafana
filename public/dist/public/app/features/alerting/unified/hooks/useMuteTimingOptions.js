import { useMemo } from 'react';
import { useAlertmanager } from '../state/AlertmanagerContext';
import { timeIntervalToString } from '../utils/alertmanager';
import { useAlertmanagerConfig } from './useAlertmanagerConfig';
export function useMuteTimingOptions() {
    const { selectedAlertmanager } = useAlertmanager();
    const { currentData } = useAlertmanagerConfig(selectedAlertmanager);
    const config = currentData === null || currentData === void 0 ? void 0 : currentData.alertmanager_config;
    return useMemo(() => {
        var _a, _b;
        const muteTimingsOptions = (_b = (_a = config === null || config === void 0 ? void 0 : config.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.map((value) => ({
            value: value.name,
            label: value.name,
            description: value.time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
        }))) !== null && _b !== void 0 ? _b : [];
        return muteTimingsOptions;
    }, [config]);
}
//# sourceMappingURL=useMuteTimingOptions.js.map