import { css } from '@emotion/css';
import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { Alert, Button, type ButtonVariant, Tooltip, useStyles2 } from '@grafana/ui';
import { LogMessages, logInfo, trackCreateRuleFromPanelDrawerOpened } from 'app/features/alerting/unified/Analytics';
import { AlertRuleDrawerForm } from 'app/features/alerting/unified/components/AlertRuleDrawerForm';
import { createPanelAlertRuleNavigation } from 'app/features/alerting/unified/utils/navigation';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

import { type ButtonFill } from '../../../../../../packages/grafana-ui/src/components/Button/Button';

interface ScenesNewRuleFromPanelButtonProps {
  panel: VizPanel;
  className?: string;
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  compactAlert?: boolean;
  fill?: ButtonFill;
  disabled?: boolean;
}
export const ScenesNewRuleFromPanelButton = ({
  panel,
  className,
  variant = 'primary',
  size = 'md',
  fill = 'solid',
  compactAlert = false,
  disabled = false,
}: ScenesNewRuleFromPanelButtonProps) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  const { loading, value: formValues } = useAsync(() => scenesPanelToRuleFormValues(panel), [panel]);
  const [isOpen, setIsOpen] = useState(false);

  if (disabled) {
    return (
      <Tooltip
        content={t(
          'dashboard-scene.scenes-new-rule-from-panel-button.disabled-tooltip',
          'Save the dashboard before creating alert rules'
        )}
      >
        <span>
          <Button disabled icon="bell" variant={variant} size={size} fill={fill} className={className}>
            <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
          </Button>
        </span>
      </Tooltip>
    );
  }

  if (loading) {
    return (
      <Button disabled={true} variant={variant} size={size}>
        <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
      </Button>
    );
  }

  if (!formValues) {
    return compactAlert ? (
      <div className={styles.compactAlert}>
        <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.body-no-alerting-capable-query-found">
          Cannot create alerts from this panel because no query to an alerting capable datasource is found.
        </Trans>
      </div>
    ) : (
      <Alert
        severity="info"
        title={t(
          'dashboard-scene.scenes-new-rule-from-panel-button.title-no-alerting-capable-query-found',
          'No alerting capable query found'
        )}
      >
        <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.body-no-alerting-capable-query-found">
          Cannot create alerts from this panel because no query to an alerting capable datasource is found.
        </Trans>
      </Alert>
    );
  }

  const { onContinueInAlertingFromDrawer, onButtonClick } = createPanelAlertRuleNavigation(
    () => scenesPanelToRuleFormValues(panel),
    location
  );

  const shouldUseDrawer = config.featureToggles.createAlertRuleFromPanel;

  if (shouldUseDrawer) {
    return (
      <>
        <Button
          icon="bell"
          variant={variant}
          size={size}
          fill={fill}
          className={className}
          data-testid="create-alert-rule-button-drawer"
          onClick={() => {
            logInfo(LogMessages.alertRuleFromPanel);
            trackCreateRuleFromPanelDrawerOpened();
            setIsOpen(true);
          }}
        >
          <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
        </Button>
        <AlertRuleDrawerForm
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onContinueInAlerting={onContinueInAlertingFromDrawer}
          prefill={formValues ?? undefined}
        />
      </>
    );
  }

  return (
    <Button
      icon="bell"
      onClick={onButtonClick}
      className={className}
      variant={variant}
      fill={fill}
      size={size}
      data-testid="create-alert-rule-button"
    >
      <Trans i18nKey="dashboard-scene.scenes-new-rule-from-panel-button.new-alert-rule">New alert rule</Trans>
    </Button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  compactAlert: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.maxContrast,
  }),
});
