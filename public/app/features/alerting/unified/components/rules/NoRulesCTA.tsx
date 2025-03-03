import { EmptyState, LinkButton, Stack, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useRulesAccess } from '../../utils/accessControlHooks';

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
            <Stack direction="row" alignItems="center" justifyContent="center">
              {canCreateAnything && (
                <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/alerting">
                  <Trans i18nKey="alerting.list-view.empty.new-alert-rule">New alert rule</Trans>
                </LinkButton>
              )}
              {canCreateCloudRules && (
                <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/recording">
                  <Trans i18nKey="alerting.list-view.empty.new-recording-rule">New recording rule</Trans>
                </LinkButton>
              )}
            </Stack>
          ) : null
        }
      >
        <>
          <Trans i18nKey="alerting.list-view.empty.provisioning">
            You can also define rules through file provisioning or Terraform.{' '}
            <TextLink
              href="https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/"
              external
            >
              Learn more
            </TextLink>
          </Trans>
        </>
      </EmptyState>
    </div>
  );
};
