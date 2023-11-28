import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { Messages } from './AlertDetails.messages';
import { getStyles } from './AlertDetails.styles';
export const AlertDetails = ({ labels }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { "data-testid": "alert-details-wrapper", className: styles.wrapper },
        React.createElement("span", null, Messages.labels),
        React.createElement(AlertLabels, { labels: labels })));
};
//# sourceMappingURL=AlertDetails.js.map