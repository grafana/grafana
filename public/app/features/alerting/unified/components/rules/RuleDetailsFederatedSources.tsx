import React from 'react';

import { CombinedRuleGroup } from 'app/types/unified-alerting';

import { DetailsField } from '../DetailsField';

interface Props {
  group: CombinedRuleGroup;
}

const RuleDetailsFederatedSources = ({ group }: Props) => {
  const sourceTenants = group.source_tenants ?? [];

  return (
    <DetailsField label="Tenant sources">
      <>
        {sourceTenants.map((tenant) => (
          <div key={tenant}>{tenant}</div>
        ))}
      </>
    </DetailsField>
  );
};

export { RuleDetailsFederatedSources };
