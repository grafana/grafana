import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { useAlertingContext, useQueryEditorUIContext } from '../QueryEditorContext';

export function AlertIndicator() {
  const { alertRules, loading } = useAlertingContext();
  const { cardType, setSelectedAlert } = useQueryEditorUIContext();

  if (loading) {
    return null;
  }

  if (alertRules.length === 0) {
    return null;
  }

  const isAlertView = cardType === QueryEditorType.Alert;

  const handleClick = () => {
    if (isAlertView) {
      setSelectedAlert(null);
    } else if (alertRules.length > 0) {
      // Default alert view to the first alert
      setSelectedAlert(alertRules[0]);
    }
  };

  const tooltip = isAlertView
    ? t('query-editor-next.sidebar.alert-indicator.tooltip-hide', 'Hide alert rules')
    : t('query-editor-next.sidebar.alert-indicator.tooltip', 'View alert rules');

  const ariaLabel = isAlertView
    ? t('query-editor-next.sidebar.alert-indicator.button-label-hide', 'Hide alert rules')
    : t('query-editor-next.sidebar.alert-indicator.button-label', 'View alert rules');

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
      {isAlertView ? t('query-editor-next.sidebar.alert-indicator.close', 'Close') : `(${alertRules.length})`}
    </Button>
  );
}
