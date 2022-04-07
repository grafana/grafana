import React from 'react';
import { SectionContentProps } from './SectionContent.types';
import { Messages } from './SectionContent.messages';
import { Advisor } from '../Advisor/Advisor';
export const SectionContent = ({ entitlement }: SectionContentProps) => {
  const {
    summary,
    tier,
    totalUnits,
    supportLevel,
    startDate,
    endDate,
    platform: { securityAdvisor, configAdvisor },
  } = entitlement;

  return (
    <div>
      <p>
        <strong>{Messages.startDate}</strong>: {startDate} <br />
        <strong>{Messages.endDate}</strong>: {endDate} <br />
      </p>
      <p>
        <strong>{Messages.summary}</strong>: {summary} <br />
        <strong>{Messages.tier}</strong>: {tier} <br />
        <strong>{Messages.totalUnits}</strong>: {totalUnits}
        <br />
        <strong>{Messages.supportLevel}</strong>: {supportLevel} <br />
        <strong>{Messages.platform}</strong>:
        <Advisor label={Messages.configAdvisor} hasAdvisor={configAdvisor} />
        <Advisor label={Messages.securityAdvisor} hasAdvisor={securityAdvisor} />
      </p>
    </div>
  );
};
