import { css } from '@emotion/css';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, logInfo } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button, ButtonVariant, useStyles2 } from '@grafana/ui';
import { LogMessages } from 'app/features/alerting/unified/Analytics';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';

import { ButtonFill } from '../../../../../../packages/grafana-ui/src/components/Button/Button';

interface ScenesNewRuleFromPanelButtonProps {
  panel: VizPanel;
  className?: string;
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  compactAlert?: boolean;
  fill?: ButtonFill;
}
export const ScenesNewRuleFromPanelButton = ({
  panel,
  className,
  variant = 'primary',
  size = 'md',
  fill = 'solid',
  compactAlert = false,
}: ScenesNewRuleFromPanelButtonProps) => {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  const { loading, value: formValues } = useAsync(() => scenesPanelToRuleFormValues(panel), [panel]);

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

  const onClick = async () => {
    logInfo(LogMessages.alertRuleFromPanel);

    const updateToDateFormValues = await scenesPanelToRuleFormValues(panel);

    const ruleFormUrl = urlUtil.renderUrl('/alerting/new', {
      defaults: JSON.stringify(updateToDateFormValues),
      returnTo: location.pathname + location.search,
    });

    locationService.push(ruleFormUrl);
  };

  return (
    <Button
      icon="bell"
      onClick={onClick}
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
