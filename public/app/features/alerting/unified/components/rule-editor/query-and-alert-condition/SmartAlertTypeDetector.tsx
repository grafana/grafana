import { useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourceJsonData } from '@grafana/schema';
import { RadioButtonGroup, Stack, Text } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';

import { getCanSwitch } from './utils';

interface SmartAlertTypeDetectorProps {
  editingExistingRule: boolean;
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  queries: AlertQuery[];
  onClickSwitch: () => void;
}

export function SmartAlertTypeDetector({
  editingExistingRule,
  rulesSourcesWithRuler,
  queries,
  onClickSwitch,
}: SmartAlertTypeDetectorProps) {
  const { getValues } = useFormContext<RuleFormValues>();

  const [ruleFormType] = getValues(['type']);
  const canSwitch = getCanSwitch({ queries, ruleFormType, rulesSourcesWithRuler });

  const options = [
    { label: t('alerting.smart-alert-type-detector.grafana-managed', 'Grafana-managed'), value: RuleFormType.grafana },
    {
      label: t('alerting.smart-alert-type-detector.data-source-managed', 'Data source-managed'),
      value: RuleFormType.cloudAlerting,
    },
  ];

  // if we can't switch to data-source managed, disable it
  // TODO figure out how to show a popover to the user to indicate _why_ it's disabled
  const disabledOptions = canSwitch ? [] : [RuleFormType.cloudAlerting];

  return (
    <Stack direction="column" gap={1} alignItems="flex-start">
      <Stack direction="column" gap={0}>
        <Text variant="h5">
          <Trans i18nKey="alerting.smart-alert-type-detector.rule-type">Rule type</Trans>
        </Text>
        <Stack direction="row" gap={0.5} alignItems="center">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.smart-alert-type-detector.select-where-alert-managed">
              Select where the alert rule will be managed.
            </Trans>
          </Text>
          <NeedHelpInfo
            contentText={
              <>
                <Text color="primary" variant="h6">
                  <Trans i18nKey="alerting.smart-alert-type-detector.grafanamanaged-alert-rules">
                    Grafana-managed alert rules
                  </Trans>
                </Text>
                <p>
                  <Trans i18nKey="alerting.smart-alert-type-detector.grafanamanaged-alert-rules-description">
                    Grafana-managed alert rules allow you to create alerts that can act on data from any of our
                    supported data sources, including having multiple data sources in the same rule. You can also add
                    expressions to transform your data and set alert conditions. Using images in alert notifications is
                    also supported.
                  </Trans>
                </p>
                <Text color="primary" variant="h6">
                  <Trans i18nKey="alerting.smart-alert-type-detector.data-sourcemanaged-alert-rules">
                    Data source-managed alert rules
                  </Trans>
                </Text>
                <p>
                  <Trans i18nKey="alerting.smart-alert-type-detector.data-sourcemanaged-alert-rules-description">
                    Data source-managed alert rules can be used for Grafana Mimir or Grafana Loki data sources which
                    have been configured to support rule creation. The use of expressions or multiple queries is not
                    supported.
                  </Trans>
                </p>
              </>
            }
            externalLink="https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/"
            linkText="Read about alert rule types"
            title={t('alerting.smart-alert-type-detector.title-alert-rule-types', 'Alert rule types')}
          />
        </Stack>
      </Stack>
      <RadioButtonGroup
        options={options}
        disabled={editingExistingRule}
        disabledOptions={disabledOptions}
        value={ruleFormType}
        onChange={onClickSwitch}
        data-testid="rule-type-radio-group"
      />
      {/* editing an existing rule, we just show "cannot be changed" */}
      {editingExistingRule && (
        <Text color="secondary">
          <Trans i18nKey="alerting.smart-alert-type-detector.rule-type-cannot-be-changed">
            The alert rule type cannot be changed for an existing rule.
          </Trans>
        </Text>
      )}
      {/* in regular alert creation we tell the user what options they have when using a cloud data source */}
      {!editingExistingRule && (
        <>
          {canSwitch ? (
            <Text color="secondary">
              {ruleFormType === RuleFormType.grafana
                ? t(
                    'alerting.smart-alert-type-detector.switch-to-data-source-managed',
                    'The data source selected in your query supports alert rule management. Switch to data source-managed if you want the alert rule to be managed by the data source instead of Grafana.'
                  )
                : t(
                    'alerting.smart-alert-type-detector.switch-to-grafana-managed',
                    'Switch to Grafana-managed to use expressions, multiple queries, images in notifications and various other features.'
                  )}
            </Text>
          ) : (
            <Text color="secondary">
              <Trans i18nKey="alerting.smart-alert-type-detector.rule-type-grafana-managed">
                Based on the selected data sources this alert rule will be Grafana-managed.
              </Trans>
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
