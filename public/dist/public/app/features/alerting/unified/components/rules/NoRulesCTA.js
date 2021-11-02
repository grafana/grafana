import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';
import React from 'react';
import { CallToActionCard } from '@grafana/ui';
export var NoRulesSplash = function () {
    if (contextSrv.hasEditPermissionInFolders || contextSrv.isEditor) {
        return (React.createElement(EmptyListCTA, { title: "You haven`t created any alert rules yet", buttonIcon: "bell", buttonLink: 'alerting/new', buttonTitle: "New alert rule", proTip: "you can also create alert rules from existing panels and queries.", proTipLink: "https://grafana.com/docs/", proTipLinkTitle: "Learn more", proTipTarget: "_blank" }));
    }
    return React.createElement(CallToActionCard, { message: "No rules exist yet.", callToActionElement: React.createElement("div", null) });
};
//# sourceMappingURL=NoRulesCTA.js.map