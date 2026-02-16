import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { useAlertingContext } from '../QueryEditorContext';

/**
 * Displays a clickable bell icon button showing the number of alert rules associated with this panel.
 * The button is always blue. Clicking it selects the first alert and shows alert cards in the sidebar.
 * Used in the QueryStack header to provide visibility of alerting configuration.
 */
export function AlertIndicator() {
  const { alertRules, loading } = useAlertingContext();
  // const { setSelectedAlert } = useQueryEditorUIContext();

  if (loading) {
    return null;
  }

  if (alertRules.length === 0) {
    return null;
  }

  const handleClick = () => {
    // Select the first alert to show the alerts view
    // if (alertRules.length > 0) {
    //   setSelectedAlert(alertRules[0]);
    // }
    console.log('Alert indicator clicked');
  };

  return (
    <Button
      tooltip={t('query-editor-next.sidebar.alert-indicator.tooltip', 'View alert rules')}
      fill="text"
      variant="primary"
      icon="bell"
      size="sm"
      onClick={handleClick}
      aria-label={t('query-editor-next.sidebar.alert-indicator.button-label', 'View alert rules')}
    >
      ({alertRules.length})
    </Button>
  );
}
