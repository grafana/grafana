import { useTranslate } from '@grafana/i18n';
import { CombinedRuleGroup } from 'app/types/unified-alerting';

import { DetailsField } from '../DetailsField';

interface Props {
  group: CombinedRuleGroup;
}

const RuleDetailsFederatedSources = ({ group }: Props) => {
  const { t } = useTranslate();
  const sourceTenants = group.source_tenants ?? [];

  return (
    <DetailsField label={t('alerting.rule-details-federated-sources.label-tenant-sources', 'Tenant sources')}>
      <>
        {sourceTenants.map((tenant) => (
          <div key={tenant}>{tenant}</div>
        ))}
      </>
    </DetailsField>
  );
};

export { RuleDetailsFederatedSources };
