import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, EmptyState, LinkButton, Menu, MenuItem, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { createRelativeUrl } from '../../utils/url';

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
        <TextLink href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/" external>
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
          <TextLink
            href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/"
            external
          >
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

export function CloudNoRulesCTA({ dataSourceName }: { dataSourceName: string }) {
  const styles = useStyles2(getCloudNoRulesStyles);
  const { canCreateCloudRules } = useRulesAccess();

  const newAlertingRuleUrl = getNewDataSourceRuleUrl(dataSourceName, RuleFormType.cloudAlerting);
  const newRecordingRuleUrl = getNewDataSourceRuleUrl(dataSourceName, RuleFormType.cloudRecording);

  return (
    <div className={styles.container}>
      <Text variant="h5">
        <Trans i18nKey="alerting.list-view.empty.ds-no-rules">This data source has no rules configured</Trans>
      </Text>
      {canCreateCloudRules && (
        <Stack direction="row" alignItems="center" justifyContent="center">
          <LinkButton variant="secondary" size="sm" icon="plus" href={newAlertingRuleUrl}>
            <Trans i18nKey="alerting.list-view.empty.new-ds-managed-alerting-rule">
              New data source-managed alerting rule
            </Trans>
          </LinkButton>
          <LinkButton variant="secondary" size="sm" icon="plus" href={newRecordingRuleUrl}>
            <Trans i18nKey="alerting.list-view.empty.new-ds-managed-recording-rule">
              New data source-managed recording rule
            </Trans>
          </LinkButton>
        </Stack>
      )}
    </div>
  );
}

function getNewDataSourceRuleUrl(
  dataSourceName: string,
  type: RuleFormType.cloudAlerting | RuleFormType.cloudRecording
) {
  const urlRuleType = type === RuleFormType.cloudAlerting ? 'alerting' : 'recording';
  const formDefaults: Partial<RuleFormValues> = {
    dataSourceName,
    editorSettings: {
      simplifiedQueryEditor: false,
      simplifiedNotificationEditor: false,
    },
    type,
  };

  return createRelativeUrl(`/alerting/new/${urlRuleType}`, { defaults: JSON.stringify(formDefaults) });
}

const getCloudNoRulesStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(1),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2, 1),
  }),
});
