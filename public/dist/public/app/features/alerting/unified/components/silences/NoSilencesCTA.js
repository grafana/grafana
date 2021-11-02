import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';
import React from 'react';
import { makeAMLink } from '../../utils/misc';
export var NoSilencesSplash = function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName;
    if (contextSrv.isEditor) {
        return (React.createElement(EmptyListCTA, { title: "You haven't created any silences yet", buttonIcon: "bell-slash", buttonLink: makeAMLink('alerting/silence/new', alertManagerSourceName), buttonTitle: "New silence" }));
    }
    return React.createElement(CallToActionCard, { callToActionElement: React.createElement("div", null), message: "No silences found." });
};
//# sourceMappingURL=NoSilencesCTA.js.map