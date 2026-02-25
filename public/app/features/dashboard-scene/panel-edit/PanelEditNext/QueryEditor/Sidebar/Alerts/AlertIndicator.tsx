import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { useAlertingContext, useQueryEditorUIContext } from '../../QueryEditorContext';

export function AlertIndicator() {
  const { alertRules, loading } = useAlertingContext();
  const { activeContext, setActiveContext } = useQueryEditorUIContext();

  if (loading) {
    return null;
  }

  const isAlertView = activeContext.view === 'alerts';

  const handleClick = () => {
    if (isAlertView) {
      setActiveContext({ view: 'data', selection: { kind: 'none' } });
    } else {
      setActiveContext({ view: 'alerts', alertId: alertRules[0]?.alertId ?? null });
    }
  };

  const helperText = isAlertView
    ? t('query-editor-next.sidebar.alert-indicator.button-label-hide', 'Hide alert rules')
    : t('query-editor-next.sidebar.alert-indicator.button-label', 'View alert rules');

  const buttonText = `(${alertRules.length})`;

  return (
    <Button
      aria-label={helperText}
      fill="text"
      icon={isAlertView ? 'times' : 'bell'}
      onClick={handleClick}
      size="sm"
      tooltip={helperText}
      variant="primary"
    >
      {isAlertView ? t('query-editor-next.sidebar.alert-indicator.close', 'Close') : buttonText}
    </Button>
  );
}
