import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { useAlertingContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { EMPTY_ALERT_SENTINEL } from '../types';

export function AlertIndicator() {
  const { alertRules, loading } = useAlertingContext();
  const { cardType, setSelectedAlert } = useQueryEditorUIContext();

  if (loading) {
    return null;
  }

  const isAlertView = cardType === QueryEditorType.Alert;
  const hasAlerts = alertRules.length > 0;

  const handleClick = () => {
    if (isAlertView) {
      setSelectedAlert(null);
    } else {
      setSelectedAlert(hasAlerts ? alertRules[0] : EMPTY_ALERT_SENTINEL);
    }
  };

  const buttonText = `(${alertRules.length})`;

  const tooltip = isAlertView
    ? t('query-editor-next.sidebar.alert-indicator.tooltip-hide', 'Hide alert rules')
    : hasAlerts
      ? t('query-editor-next.sidebar.alert-indicator.tooltip', 'View alert rules')
      : t('query-editor-next.sidebar.alert-indicator.tooltip-create', 'Create alert rule');

  const ariaLabel = isAlertView
    ? t('query-editor-next.sidebar.alert-indicator.button-label-hide', 'Hide alert rules')
    : hasAlerts
      ? t('query-editor-next.sidebar.alert-indicator.button-label', 'View alert rules')
      : t('query-editor-next.sidebar.alert-indicator.button-label-create', 'Create alert rule');

  return (
    <Button
      tooltip={tooltip}
      fill="text"
      variant="primary"
      icon={isAlertView ? 'times' : 'bell'}
      size="sm"
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      {isAlertView ? t('query-editor-next.sidebar.alert-indicator.close', 'Close') : buttonText}
    </Button>
  );
}
