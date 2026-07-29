import { Trans, t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { createRelativeUrl } from '../../utils/url';

interface K8sRuleActionsProps {
  /** The k8s rule uid (the `name` field on a search hit). */
  uid: string;
}

/**
 * Lightweight, definition-only row actions for v3 search hits: View + Edit links built from the rule
 * uid. Stateful actions (pause, silence, delete, duplicate, export) need the full rule and land in a
 * later PR — the definition-only search hit can't drive them.
 */
export function K8sRuleActions({ uid }: K8sRuleActionsProps) {
  return (
    <Stack gap={0} alignItems="center" wrap="nowrap">
      <LinkButton
        title={t('alerting.rule-list.v3.actions.view', 'View')}
        size="sm"
        variant="secondary"
        fill="text"
        href={createRelativeUrl(`/alerting/grafana/${uid}/view`)}
      >
        <Trans i18nKey="common.view">View</Trans>
      </LinkButton>
      <LinkButton
        title={t('alerting.rule-list.v3.actions.edit', 'Edit')}
        size="sm"
        variant="secondary"
        fill="text"
        href={createRelativeUrl(`/alerting/${encodeURIComponent(uid)}/edit`)}
      >
        <Trans i18nKey="common.edit">Edit</Trans>
      </LinkButton>
    </Stack>
  );
}
