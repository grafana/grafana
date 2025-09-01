import { CentralAlertHistoryScene } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

export function AlertRuleHistory({
  defaultLabelsFilter,
  defaultTimeRange,
  hideFilters,
}: {
  defaultLabelsFilter?: string;
  defaultTimeRange?: { from: string; to: string };
  hideFilters?: boolean;
}) {
  return (
    <CentralAlertHistoryScene
      defaultLabelsFilter={defaultLabelsFilter}
      defaultTimeRange={defaultTimeRange}
      hideFilters={hideFilters}
    />
  );
}
