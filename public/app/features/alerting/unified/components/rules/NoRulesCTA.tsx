import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, EmptyState, LinkButton, Menu, MenuItem, Stack, TextLink } from '@grafana/ui';

import { useRulesAccess } from '../../utils/accessControlHooks';
import { DOCS_URL_PROVISION_ALERTING } from '../../utils/docs';

const RecordingRulesButtons = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();

  const grafanaRecordingRulesEnabled = config.unifiedAlerting.recordingRulesEnabled && canCreateGrafanaRules;

  const canCreateAll = canCreateGrafanaRules && canCreateCloudRules && grafanaRecordingRulesEnabled;

  // User can create Grafana and DS-managed recording rules, show a dropdown
  if (canCreateAll) {
    return (
      <Dropdown
        overlay={
          <Menu>
            <MenuItem
              url="alerting/new/grafana-recording"
              icon="plus"
              label={t('alerting.list-view.empty.new-grafana-recording-rule', 'New recording rule')}
            />
            <MenuItem
              url="alerting/new/recording"
              icon="plus"
              label={t(
                'alerting.list-view.empty.new-ds-managed-recording-rule',
                'New data source-managed recording rule'
              )}
            />
          </Menu>
        }
      >
        <LinkButton variant="primary" icon="plus" size="lg">
          <Trans i18nKey="alerting.list-view.empty.new-recording-rule">New recording rule</Trans>
        </LinkButton>
      </Dropdown>
    );
  }

  // ...Otherwise, just show the buttons for each type of recording rule
  // (this will just be one or the other)
  return (
    <>
      {canCreateGrafanaRules && grafanaRecordingRulesEnabled && (
        <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/grafana-recording">
          <Trans i18nKey="alerting.list-view.empty.new-grafana-recording-rule">New recording rule</Trans>
        </LinkButton>
      )}
      {canCreateCloudRules && (
        <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/recording">
          <Trans i18nKey="alerting.list-view.empty.new-ds-managed-recording-rule">
            New data source-managed recording rule
          </Trans>
        </LinkButton>
      )}
    </>
  );
};

export const NoRulesSplash = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();
  const canCreateAnything = canCreateGrafanaRules || canCreateCloudRules;

  return (
    <div>
      <EmptyState
        message={t('alerting.list-view.empty.no-rules-created', "You haven't created any rules yet")}
        variant="call-to-action"
        button={
          canCreateAnything ? (
            <Stack direction="column" alignItems="center" justifyContent="center">
              {canCreateAnything && (
                <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/alerting">
                  <Trans i18nKey="alerting.list-view.empty.new-alert-rule">New alert rule</Trans>
                </LinkButton>
              )}
              <RecordingRulesButtons />
            </Stack>
          ) : null
        }
      >
        <Trans i18nKey="alerting.list-view.empty.provisioning">
          You can also define rules through file provisioning or Terraform
        </Trans>
        <TextLink href={DOCS_URL_PROVISION_ALERTING} external>
          <Trans i18nKey="alerting.common.learn-more">Learn more</Trans>
        </TextLink>
      </EmptyState>
    </div>
  );
};

export function GrafanaNoRulesCTA() {
  const { canCreateGrafanaRules } = useRulesAccess();

  const grafanaRecordingRulesEnabled = config.unifiedAlerting.recordingRulesEnabled && canCreateGrafanaRules;

  return (
    <EmptyState
      message={t('alerting.list-view.empty.no-rules-created', "You haven't created any rules yet")}
      variant="call-to-action"
    >
      <Stack direction="column" alignItems="center" justifyContent="center" gap={2}>
        <Stack direction="row" alignItems="center" justifyContent="center">
          <Trans i18nKey="alerting.list-view.empty.provisioning">
            You can also define rules through file provisioning or Terraform
          </Trans>
          <TextLink href={DOCS_URL_PROVISION_ALERTING} external>
            <Trans i18nKey="alerting.common.learn-more">Learn more</Trans>
          </TextLink>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="center">
          {canCreateGrafanaRules && (
            <LinkButton variant="primary" icon="plus" href="alerting/new/alerting">
              <Trans i18nKey="alerting.list-view.empty.new-grafana-alerting-rule">New alert rule</Trans>
            </LinkButton>
          )}
          {canCreateGrafanaRules && grafanaRecordingRulesEnabled && (
            <LinkButton variant="primary" icon="plus" href="alerting/new/grafana-recording">
              <Trans i18nKey="alerting.list-view.empty.new-grafana-recording-rule">New recording rule</Trans>
            </LinkButton>
          )}
        </Stack>
      </Stack>
    </EmptyState>
  );
}
