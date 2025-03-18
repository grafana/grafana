import { LoadingPlaceholder } from '@grafana/ui';

import { RulesTable } from '../components/rules/RulesTable';
import { useCombinedRules } from '../hooks/useCombinedRuleNamespaces';

interface Props {
  dashboardUid: string;
}

export default function AlertRulesDrawerContent({ dashboardUid }: Props) {
  const { loading, result: grafanaNamespaces } = useCombinedRules(dashboardUid);
  const rules = grafanaNamespaces ? grafanaNamespaces.flatMap((ns) => ns.groups).flatMap((g) => g.rules) : [];

  return (
    <>
      {loading ? (
        <LoadingPlaceholder text="Loading alert rules" />
      ) : (
        <RulesTable rules={rules} showNextEvaluationColumn={false} showGroupColumn={false} />
      )}
    </>
  );
}
