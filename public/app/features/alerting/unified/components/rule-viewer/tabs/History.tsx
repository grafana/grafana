import { Suspense, lazy } from 'react';

import { config } from '@grafana/runtime';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { StateHistoryImplementation } from '../../../hooks/useStateHistoryModal';

const AnnotationsStateHistory = lazy(() => import('../../../components/rules/state-history/StateHistory'));
const LokiStateHistory = lazy(() => import('../../../components/rules/state-history/LokiStateHistory'));

interface HistoryProps {
  rule: RulerGrafanaRuleDTO;
}

const History = ({ rule }: HistoryProps) => {
  // can be "loki", "multiple" or "annotations"
  const stateHistoryBackend = config.unifiedAlerting.alertStateHistoryBackend;
  // can be "loki" or "annotations"
  const stateHistoryPrimary = config.unifiedAlerting.alertStateHistoryPrimary;

  // if "loki" is either the backend or the primary, show the new state history implementation
  const usingNewAlertStateHistory = [stateHistoryBackend, stateHistoryPrimary].some(
    (implementation) => implementation === StateHistoryImplementation.Loki
  );
  const implementation = usingNewAlertStateHistory
    ? StateHistoryImplementation.Loki
    : StateHistoryImplementation.Annotations;

  const ruleID = rule.grafana_alert.id ?? '';
  const ruleUID = rule.grafana_alert.uid;

  return (
    <Suspense fallback={'Loading...'}>
      {implementation === StateHistoryImplementation.Loki && <LokiStateHistory ruleUID={ruleUID} />}
      {implementation === StateHistoryImplementation.Annotations && <AnnotationsStateHistory alertId={ruleID} />}
    </Suspense>
  );
};

export { History };
