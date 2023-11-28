import React from 'react';
import { Advisor } from '../Advisor/Advisor';
import { Messages } from './SectionContent.messages';
export const SectionContent = ({ entitlement }) => {
    const { summary, tier, totalUnits, supportLevel, startDate, endDate, platform: { securityAdvisor, configAdvisor }, } = entitlement;
    return (React.createElement("div", null,
        React.createElement("p", null,
            React.createElement("strong", null, Messages.startDate),
            ": ",
            startDate,
            " ",
            React.createElement("br", null),
            React.createElement("strong", null, Messages.endDate),
            ": ",
            endDate,
            " ",
            React.createElement("br", null)),
        React.createElement("p", null,
            React.createElement("strong", null, Messages.summary),
            ": ",
            summary,
            " ",
            React.createElement("br", null),
            React.createElement("strong", null, Messages.tier),
            ": ",
            tier,
            " ",
            React.createElement("br", null),
            React.createElement("strong", null, Messages.totalUnits),
            ": ",
            totalUnits,
            React.createElement("br", null),
            React.createElement("strong", null, Messages.supportLevel),
            ": ",
            supportLevel,
            " ",
            React.createElement("br", null),
            React.createElement("strong", null, Messages.platform),
            ":",
            React.createElement(Advisor, { label: Messages.configAdvisor, hasAdvisor: configAdvisor }),
            React.createElement(Advisor, { label: Messages.securityAdvisor, hasAdvisor: securityAdvisor }))));
};
//# sourceMappingURL=SectionContent.js.map