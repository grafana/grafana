import { config } from '@grafana/runtime';
import { Dropdown, EmptyState, LinkButton, Menu, MenuItem, Stack, TextLink } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useRulesAccess } from '../../utils/accessControlHooks';

const RecordingRulesButtons = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();
  const grafanaRecordingRulesEnabled = config.featureToggles.grafanaManagedRecordingRules;
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
              label={t('alerting.list-view.empty.new-grafana-recording-rule', 'New Grafana-managed recording rule')}
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
          <Trans i18nKey="alerting.list-view.empty.new-grafana-recording-rule">
            New Grafana-managed recording rule
          </Trans>
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
        message="You haven't created any rules yet"
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
          You can also define rules through file provisioning or Terraform.{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/"
            external
          >
            Learn more
          </TextLink>
        </Trans>
      </EmptyState>
    </div>
  );
};
