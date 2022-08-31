import React, { FC } from 'react';

import { CombinedRuleGroup } from 'app/types/unified-alerting';

import { DetailsField } from '../DetailsField';

interface Props {
  group: CombinedRuleGroup;
}

const RuleDetailsFederatedSources: FC<Props> = ({ group }) => {
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
