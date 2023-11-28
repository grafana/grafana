import React from 'react';
import { Card } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
export const EmptyCorrelationsCTA = ({ onClick, canWriteCorrelations }) => {
    // TODO: if there are no datasources show a different message
    return canWriteCorrelations ? (React.createElement(EmptyListCTA, { title: "You haven't defined any correlation yet.", buttonIcon: "gf-glue", onClick: onClick, buttonTitle: "Add correlation", proTip: "you can also define correlations via datasource provisioning" })) : (React.createElement(Card, null,
        React.createElement(Card.Heading, null, "There are no correlations configured yet."),
        React.createElement(Card.Description, null, "Please contact your administrator to create new correlations.")));
};
//# sourceMappingURL=EmptyCorrelationsCTA.js.map