import { Suspense, lazy } from 'react';

import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { StateHistoryImplementation, getStateHistoryImplementation } from '../../../utils/config';

const AnnotationsStateHistory = lazy(() => import('../../../components/rules/state-history/StateHistory'));
const LokiStateHistory = lazy(() => import('../../../components/rules/state-history/LokiStateHistory'));

interface HistoryProps {
  rule: RulerGrafanaRuleDTO;
}

const History = ({ rule }: HistoryProps) => {
  const implementation = getStateHistoryImplementation();

  // no backend can answer history queries, so there is nothing to show
  if (implementation === StateHistoryImplementation.Unavailable) {
    return null;
  }

  const ruleUID = rule.grafana_alert.uid;

  return (
    <Suspense fallback={'Loading...'}>
      {implementation === StateHistoryImplementation.Loki && <LokiStateHistory ruleUID={ruleUID} />}
      {implementation === StateHistoryImplementation.Annotations && <AnnotationsStateHistory ruleUID={ruleUID} />}
    </Suspense>
  );
};

export { History };
