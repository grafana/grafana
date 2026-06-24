import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Card, EmptyState, LinkButton, Stack, Text, TextLink, Tooltip } from '@grafana/ui';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';
import { Annotation, GRAFANA_RULES_SOURCE_NAME, annotationLabels } from '../utils/constants';
import { createRelativeUrl } from '../utils/url';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

// The annotations that make an alert notification actionable. A rule is flagged on
// this tab when any of these is missing or empty.
const REQUIRED_ANNOTATIONS = [Annotation.summary, Annotation.description, Annotation.runbookURL];

interface FlaggedRule {
  uid?: string;
  name: string;
  folder: string;
  group: string;
  missing: Annotation[];
}

function QualityTab() {
  const { navId, pageNav } = useAlertRulesNav();

  const { data: namespaces = [], isLoading } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
    ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    excludeAlerts: true,
  });

  const flaggedRules = useMemo<FlaggedRule[]>(() => {
    const result: FlaggedRule[] = [];
    for (const namespace of namespaces) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          // Recording rules don't notify, so annotations don't apply to them.
          if (rule.type !== PromRuleType.Alerting) {
            continue;
          }
          const annotations = rule.annotations ?? {};
          const missing = REQUIRED_ANNOTATIONS.filter((key) => !annotations[key]?.trim());
          if (missing.length > 0) {
            result.push({
              uid: 'uid' in rule ? rule.uid : undefined,
              name: rule.name,
              folder: namespace.name,
              group: group.name,
              missing,
            });
          }
        }
      }
    }
    return result;
  }, [namespaces]);

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      isLoading={isLoading}
      actions={
        flaggedRules.length > 0 ? (
          <Tooltip content={t('alerting.quality.fix-all-coming-soon', 'Coming soon — automatically generate descriptions and summaries for all flagged rules.')}>
            <Button icon="bolt" variant="primary" disabled>
              <Trans i18nKey="alerting.quality.fix-all">Fix all with AI</Trans>
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <Stack direction="column" gap={2}>
        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.quality.description">
            These alert rules are missing a summary, description, or runbook URL. Select <strong>Edit</strong> on a rule
            to add the missing details — or use <strong>Fix with AI</strong> to generate them automatically, so
            responders know what fired and what to do.
          </Trans>
        </Text>

        {flaggedRules.length === 0 && !isLoading ? (
          <EmptyState
            variant="completed"
            message={t('alerting.quality.empty', 'Every alert rule has a summary, description, and runbook URL.')}
          >
            <Trans i18nKey="alerting.quality.empty-description">
              To enforce these fields across your organization, enable the requirements in{' '}
              <TextLink href="/alerting/admin/annotations">Alert quality settings</TextLink>.
            </Trans>
          </EmptyState>
        ) : (
          <Stack direction="column" gap={1}>
            {flaggedRules.map((rule) => (
              <Card key={`${rule.folder}-${rule.group}-${rule.name}`}>
                <Card.Heading>{rule.name}</Card.Heading>
                <Card.Meta>
                  {[rule.folder, rule.group].filter(Boolean)}
                </Card.Meta>
                <Card.Description>
                  <Stack direction="row" gap={1} wrap="wrap">
                    <Text variant="bodySmall" color="secondary">
                      <Trans i18nKey="alerting.quality.missing-label">Missing:</Trans>
                    </Text>
                    {rule.missing.map((key) => (
                      <Badge key={key} color="orange" text={annotationLabels[key]} />
                    ))}
                  </Stack>
                </Card.Description>
                <Card.Actions>
                  <Tooltip
                    content={t('alerting.quality.fix-coming-soon', 'Coming soon — automatically generate a description and summary for this rule.')}
                  >
                    <Button icon="bolt" variant="primary" size="sm" disabled>
                      <Trans i18nKey="alerting.quality.fix-with-ai">Fix with AI</Trans>
                    </Button>
                  </Tooltip>
                  {rule.uid && (
                    <LinkButton
                      icon="pen"
                      variant="secondary"
                      size="sm"
                      href={createRelativeUrl(`/alerting/${rule.uid}/edit`)}
                    >
                      <Trans i18nKey="alerting.quality.edit">Edit</Trans>
                    </LinkButton>
                  )}
                </Card.Actions>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(QualityTab);
