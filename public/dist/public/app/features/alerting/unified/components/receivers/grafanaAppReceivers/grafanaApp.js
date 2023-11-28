import { onCallApi } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { isOnCallReceiver } from './onCall/onCall';
export const useGetGrafanaReceiverTypeChecker = () => {
    const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
    const { data } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
        skip: !isOnCallEnabled,
    });
    const getGrafanaReceiverType = (receiver) => {
        //CHECK FOR ONCALL PLUGIN
        const onCallIntegrations = data !== null && data !== void 0 ? data : [];
        if (isOnCallEnabled && isOnCallReceiver(receiver, onCallIntegrations)) {
            return SupportedPlugin.OnCall;
        }
        //WE WILL ADD IN HERE IF THERE ARE MORE TYPES TO CHECK
        return undefined;
    };
    return getGrafanaReceiverType;
};
export const useGetAmRouteReceiverWithGrafanaAppTypes = (receivers) => {
    const getGrafanaReceiverType = useGetGrafanaReceiverTypeChecker();
    const receiverToSelectableContactPointValue = (receiver) => {
        const amRouteReceiverValue = {
            label: receiver.name,
            value: receiver.name,
            grafanaAppReceiverType: getGrafanaReceiverType(receiver),
        };
        return amRouteReceiverValue;
    };
    return receivers.map(receiverToSelectableContactPointValue);
};
export const useGetReceiversWithGrafanaAppTypes = (receivers) => {
    const getGrafanaReceiverType = useGetGrafanaReceiverTypeChecker();
    return receivers.map((receiver) => {
        return Object.assign(Object.assign({}, receiver), { grafanaAppReceiverType: getGrafanaReceiverType(receiver) });
    });
};
//# sourceMappingURL=grafanaApp.js.map