import { useMemo } from 'react';

import { RulesTable } from 'app/features/alerting/unified/components/rules/RulesTable';

import { useAlertingContext, useQueryEditorUIContext } from './QueryEditorContext';

export function AlertEditorRenderer() {
  const { alertRules } = useAlertingContext();
  const { selectedAlert } = useQueryEditorUIContext();

  const rule = useMemo(() => {
    if (!selectedAlert) {
      return [];
    }
    const selectedAlertRule = alertRules.find(({ alertId }) => alertId === selectedAlert.alertId);
    return selectedAlertRule?.rule ? [selectedAlertRule.rule] : [];
  }, [alertRules, selectedAlert]);

  if (!selectedAlert) {
    return null;
  }

  return <RulesTable rules={rule} />;
}
