import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { CallToActionCard, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { LogMessages } from '../../Analytics';
import { useRulesAccess } from '../../utils/accessControlHooks';
export const NoRulesSplash = () => {
    const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();
    const styles = useStyles2(getStyles);
    if (canCreateGrafanaRules || canCreateCloudRules) {
        return (React.createElement("div", null,
            React.createElement("p", null, "You haven't created any alert rules yet"),
            React.createElement(Stack, { direction: "row", gap: 1, alignItems: "stretch", flexGrow: 1 },
                React.createElement("div", { className: styles.newRuleCard },
                    React.createElement(EmptyListCTA, { title: "", buttonIcon: "bell", buttonLink: 'alerting/new/alerting', buttonTitle: "New alert rule", proTip: "you can also create alert rules from existing panels and queries.", proTipLink: "https://grafana.com/docs/", proTipLinkTitle: "Learn more", proTipTarget: "_blank", onClick: () => logInfo(LogMessages.alertRuleFromScratch) })),
                React.createElement("div", { className: styles.newRuleCard },
                    React.createElement(EmptyListCTA, { title: "", buttonIcon: "plus", buttonLink: 'alerting/new/recording', buttonTitle: "New recording rule", onClick: () => logInfo(LogMessages.recordingRuleFromScratch) })))));
    }
    return React.createElement(CallToActionCard, { message: "No rules exist yet.", callToActionElement: React.createElement("div", null) });
};
const getStyles = (theme) => ({
    newRuleCard: css `
    width: calc(50% - ${theme.spacing(1)});

    > div {
      height: 100%;
    }
  `,
});
//# sourceMappingURL=NoRulesCTA.js.map