import React from 'react';
import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';
import { getInstancesPermissions } from '../../utils/access-control';
import { makeAMLink } from '../../utils/misc';
export const NoSilencesSplash = ({ alertManagerSourceName }) => {
    const permissions = getInstancesPermissions(alertManagerSourceName);
    if (contextSrv.hasPermission(permissions.create)) {
        return (React.createElement(EmptyListCTA, { title: "You haven't created any silences yet", buttonIcon: "bell-slash", buttonLink: makeAMLink('alerting/silence/new', alertManagerSourceName), buttonTitle: "Create silence" }));
    }
    return React.createElement(CallToActionCard, { callToActionElement: React.createElement("div", null), message: "No silences found." });
};
//# sourceMappingURL=NoSilencesCTA.js.map