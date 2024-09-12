import { EmptyState, LinkButton, Stack, TextLink } from '@grafana/ui';

import { useRulesAccess } from '../../utils/accessControlHooks';

export const NoRulesSplash = () => {
  const { canCreateGrafanaRules, canCreateCloudRules } = useRulesAccess();
  const canCreateAnything = canCreateGrafanaRules && canCreateCloudRules;

  return (
    <div>
      <EmptyState
        message={"You haven't created any rules yet"}
        variant="call-to-action"
        button={
          canCreateAnything ? (
            <Stack direction="row" alignItems="center" justifyContent="center">
              <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/alerting">
                New alert rule
              </LinkButton>
              <LinkButton variant="primary" icon="plus" size="lg" href="alerting/new/recording">
                New recording rule
              </LinkButton>
            </Stack>
          ) : null
        }
      >
        <>
          You can also define rules through file provisioning or Terraform.{' '}
          <TextLink
            href={'https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/'}
            external
          >
            Learn more
          </TextLink>
        </>
      </EmptyState>
    </div>
  );
};
