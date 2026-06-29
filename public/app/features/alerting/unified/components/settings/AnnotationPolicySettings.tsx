import { Trans, t } from '@grafana/i18n';
import { Badge, Box, Field, Label, Stack, Switch, Text, Tooltip } from '@grafana/ui';

import { useSettings } from './SettingsContext';

export function AnnotationPolicySettings() {
  const {
    configuration,
    isUpdating,
    setRejectAlertsWithoutDescriptions,
    setAutoFillDescriptionsWithAI,
    setRejectAlertsWithoutRunbookURL,
  } = useSettings();

  const rejectEnabled = configuration?.reject_alerts_without_descriptions ?? false;
  const autoFillEnabled = configuration?.auto_fill_descriptions_with_ai ?? false;
  const rejectRunbookEnabled = configuration?.reject_alerts_without_runbook_url ?? false;

  return (
    <Box>
      <Stack direction="column" gap={1}>
        <Text variant="h5">
          <Trans i18nKey="alerting.annotation-policy.title">Alert quality</Trans>
        </Text>
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.annotation-policy.description">
            Control whether alert rules must include descriptions, summaries, and runbook links — and whether Grafana
            can generate missing descriptions automatically.
          </Trans>
        </Text>

        <Field
          label={t('alerting.annotation-policy.reject-label', 'Require descriptions and summaries')}
          description={t(
            'alerting.annotation-policy.reject-description',
            'Alert rules without a summary or description can\'t be saved. Enable "Auto-fill with AI" to generate them automatically.'
          )}
          horizontal
          noMargin
        >
          <Switch
            value={rejectEnabled}
            disabled={isUpdating}
            onChange={(e) => setRejectAlertsWithoutDescriptions(e.currentTarget.checked)}
          />
        </Field>

        <Field
          label={t('alerting.annotation-policy.reject-runbook-label', 'Require runbook URL')}
          description={t(
            'alerting.annotation-policy.reject-runbook-description',
            "Alert rules without a runbook URL can't be saved."
          )}
          horizontal
          noMargin
        >
          <Switch
            value={rejectRunbookEnabled}
            disabled={isUpdating}
            onChange={(e) => setRejectAlertsWithoutRunbookURL(e.currentTarget.checked)}
          />
        </Field>

        {/* Auto-fill is an automatic remediation action rather than a requirement, so it sits
            below the two "Require…" policies. */}
        <Field
          label={t('alerting.annotation-policy.autofill-label', 'Auto-fill descriptions and summaries with AI')}
          description={t(
            'alerting.annotation-policy.autofill-description',
            'When an alert rule is saved without a description or summary, Grafana generates both using AI — based on the alert name, query, and labels. You can edit them at any time.'
          )}
          horizontal
          noMargin
        >
          <Switch
            value={autoFillEnabled}
            disabled={isUpdating}
            onChange={(e) => setAutoFillDescriptionsWithAI(e.currentTarget.checked)}
          />
        </Field>

        <ComingSoonChecks />
      </Stack>
    </Box>
  );
}

/**
 * Placeholder group of alert-quality checks that aren't implemented yet. The switches are
 * intentionally disabled and static — they are not wired to any settings or backend state.
 */
export function ComingSoonChecks() {
  const comingSoonTooltip = t('alerting.annotation-policy.coming-soon-tooltip', 'This check is coming soon');

  const checks = [
    {
      id: 'no-contact-point',
      label: t('alerting.annotation-policy.no-contact-point-label', 'Detect no contact point'),
      description: t(
        'alerting.annotation-policy.no-contact-point-description',
        "Flag alert rules whose notifications aren't routed to any contact point, so firing alerts never reach anyone."
      ),
    },
    {
      id: 'flapping',
      label: t('alerting.annotation-policy.flapping-label', 'Detect flapping alerts'),
      description: t(
        'alerting.annotation-policy.flapping-description',
        'Flag rules that rapidly switch between firing and resolved, creating notification noise without clear signal.'
      ),
    },
    {
      id: 'redundant',
      label: t('alerting.annotation-policy.redundant-label', 'Detect redundant alerts'),
      description: t(
        'alerting.annotation-policy.redundant-description',
        'Flag duplicate or overlapping rules that alert on the same condition, so you can consolidate them.'
      ),
    },
    {
      id: 'multidimensional',
      label: t('alerting.annotation-policy.multidimensional-label', 'Suggest multidimensional candidates'),
      description: t(
        'alerting.annotation-policy.multidimensional-description',
        'Identify rules that could be rewritten as a single multidimensional rule using by/without grouping instead of many near-identical rules.'
      ),
    },
    {
      id: 'forecast',
      label: t('alerting.annotation-policy.forecast-label', 'Suggest forecast candidates'),
      description: t(
        'alerting.annotation-policy.forecast-description',
        'Identify rules that would benefit from predictive/forecast-based conditions to catch issues before thresholds are breached.'
      ),
    },
    {
      id: 'slo',
      label: t('alerting.annotation-policy.slo-label', 'Suggest SLO candidates'),
      description: t(
        'alerting.annotation-policy.slo-description',
        'Identify rules that map to service-level objectives and could be migrated to error-budget-based SLO alerting.'
      ),
    },
    {
      id: 'groups',
      label: t('alerting.annotation-policy.groups-label', 'Suggest potential groups'),
      description: t(
        'alerting.annotation-policy.groups-description',
        'Identify related rules that could be organized into evaluation groups for more consistent timing and routing.'
      ),
    },
  ];

  return (
    <Stack direction="column" gap={1}>
      <Box marginTop={2}>
        <Text variant="h6">
          <Trans i18nKey="alerting.annotation-policy.coming-soon-title">More checks (coming soon)</Trans>
        </Text>
      </Box>

      {checks.map((check) => (
        <Tooltip key={check.id} content={comingSoonTooltip}>
          <Field
            label={
              <Label description={check.description}>
                <Stack direction="row" gap={1} alignItems="center">
                  <span>{check.label}</span>
                  <Badge color="blue" text={t('alerting.annotation-policy.coming-soon-badge', 'Coming soon')} />
                </Stack>
              </Label>
            }
            horizontal
            noMargin
          >
            <Switch value={false} disabled aria-label={check.label} />
          </Field>
        </Tooltip>
      ))}
    </Stack>
  );
}
