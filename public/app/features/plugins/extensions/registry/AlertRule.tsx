import { CentralAlertHistoryScene } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

export function AlertRuleHistory({ defaultLabelsFilter }: { defaultLabelsFilter?: string }) {
  return <CentralAlertHistoryScene defaultLabelsFilter={defaultLabelsFilter} />;
}
