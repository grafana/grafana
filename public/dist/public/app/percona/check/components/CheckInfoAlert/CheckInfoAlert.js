import React from 'react';
import { locationService } from '@grafana/runtime/src/services/LocationService';
import { useStyles2 } from '@grafana/ui';
import { AlertLocalStorage } from 'app/percona/shared/components/Elements/AlertLocalStorage/AlertLocalStorage';
import { getPerconaServer, getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { Messages } from './CheckInfoAlert.messages';
import { getStyles } from './CheckInfoAlert.styles';
export const ChecksInfoAlert = () => {
    const { result } = useSelector(getPerconaSettings);
    const { isConnectedToPortal, telemetryEnabled } = result;
    const styles = useStyles2(getStyles);
    const { serverId, serverTelemetryId } = useSelector(getPerconaServer);
    if (isConnectedToPortal) {
        return null;
    }
    return (React.createElement(AlertLocalStorage, { title: Messages.title, customButtonContent: Messages.buttonText, onCustomButtonClick: () => locationService.push(`/settings/percona-platform`), uniqueName: 'connectInfoAlert' },
        React.createElement("div", { className: styles.content },
            React.createElement("a", { "data-testid": "read-more-link", target: "_blank", rel: "noreferrer", href: telemetryEnabled
                    ? serverTelemetryId
                        ? `https://per.co.na/subscription2?utm_source=pmm-tid-${serverTelemetryId}`
                        : `https://per.co.na/subscription2?utm_source=pmm-sid-${serverId}`
                    : 'https://per.co.na/subscribemore', className: styles.link }, Messages.link),
            ' ',
            Messages.content,
            " ",
            React.createElement("br", null),
            " ",
            Messages.contentSecondPart,
            " ",
            React.createElement("i", null, Messages.advisorsList),
            ' ',
            Messages.contentThirdPart)));
};
//# sourceMappingURL=CheckInfoAlert.js.map