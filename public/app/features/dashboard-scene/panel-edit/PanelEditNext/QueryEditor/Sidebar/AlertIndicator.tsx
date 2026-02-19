import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { useAlertingContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { EMPTY_ALERT } from '../types';

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
      setSelectedAlert(hasAlerts ? alertRules[0] : EMPTY_ALERT);
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
