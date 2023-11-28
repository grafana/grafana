import { useMemo } from 'react';
import { onCallApi } from '../../../api/onCallApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { createBridgeURL } from '../../PluginBridge';
import { ReceiverTypes } from './onCall/onCall';
import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';
const onCallReceiverICon = GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[SupportedPlugin.OnCall];
const onCallReceiverTitle = 'Grafana OnCall';
const onCallReceiverMeta = {
    title: onCallReceiverTitle,
    icon: onCallReceiverICon,
};
export const useReceiversMetadata = (receivers) => {
    const { installed: isOnCallEnabled } = usePluginBridge(SupportedPlugin.OnCall);
    const { data: onCallIntegrations = [] } = onCallApi.useGrafanaOnCallIntegrationsQuery(undefined, {
        skip: !isOnCallEnabled,
    });
    return useMemo(() => {
        const result = new Map();
        receivers.forEach((receiver) => {
            var _a;
            const onCallReceiver = (_a = receiver.grafana_managed_receiver_configs) === null || _a === void 0 ? void 0 : _a.find((c) => c.type === ReceiverTypes.OnCall);
            if (onCallReceiver) {
                if (!isOnCallEnabled) {
                    result.set(receiver, Object.assign(Object.assign({}, onCallReceiverMeta), { warning: 'Grafana OnCall is not enabled' }));
                    return;
                }
                const matchingOnCallIntegration = onCallIntegrations.find((i) => i.integration_url === onCallReceiver.settings.url);
                result.set(receiver, Object.assign(Object.assign({}, onCallReceiverMeta), { externalUrl: matchingOnCallIntegration
                        ? createBridgeURL(SupportedPlugin.OnCall, `/integrations/${matchingOnCallIntegration.value}`)
                        : undefined, warning: matchingOnCallIntegration ? undefined : 'OnCall Integration no longer exists' }));
            }
        });
        return result;
    }, [isOnCallEnabled, receivers, onCallIntegrations]);
};
//# sourceMappingURL=useReceiversMetadata.js.map