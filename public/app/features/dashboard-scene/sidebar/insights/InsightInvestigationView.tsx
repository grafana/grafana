import { css } from '@emotion/css';

import { isInvestigationFinished, useInvestigationThroughLens } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Spinner, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { INSIGHTS_ORIGIN } from './askAssistant';
import { INVESTIGATION_SUMMARY_SCHEMA } from './investigation';
import { type InsightInvestigation } from './types';

export function InsightInvestigationView({ investigation }: { investigation: InsightInvestigation }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid="insight-investigation">
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Text variant="bodySmall" weight="medium">
          <Trans i18nKey="dashboard.insights.investigation.title">Investigation</Trans>
        </Text>
        {investigation.phase === 'started' && (
          <TextLink href={investigation.url} external variant="bodySmall">
            {t('dashboard.insights.investigation.open', 'Open investigation')}
          </TextLink>
        )}
      </Stack>
      <InvestigationBody investigation={investigation} />
    </div>
  );
}

function InvestigationBody({ investigation }: { investigation: InsightInvestigation }) {
  if (investigation.phase === 'starting') {
    return <Progress text={t('dashboard.insights.investigation.starting', 'Starting the investigation…')} />;
  }
  if (investigation.phase === 'failed') {
    return (
      <Text element="p" variant="bodySmall" color="error">
        {t('dashboard.insights.investigation.start-error', 'Could not start an investigation: {{error}}', {
          error: investigation.error,
        })}
      </Text>
    );
  }
  if (investigation.state === 'completed') {
    return <InvestigationSummary investigationId={investigation.investigationId} />;
  }
  if (investigation.state === 'failed') {
    return (
      <Text element="p" variant="bodySmall" color="secondary">
        <Trans i18nKey="dashboard.insights.investigation.failed">
          The investigation failed. Open it to see how far it got.
        </Trans>
      </Text>
    );
  }
  if (isInvestigationFinished(investigation.state)) {
    return (
      <Text element="p" variant="bodySmall" color="secondary">
        <Trans i18nKey="dashboard.insights.investigation.stopped">The investigation was stopped.</Trans>
      </Text>
    );
  }
  return (
    <Progress
      text={t(
        'dashboard.insights.investigation.running',
        'Investigating. It keeps running if you leave the dashboard.'
      )}
    />
  );
}

/** Mounted only once the investigation completed, because the lens reads its final report. */
function InvestigationSummary({ investigationId }: { investigationId: string }) {
  const styles = useStyles2(getStyles);
  const lens = useInvestigationThroughLens(INVESTIGATION_SUMMARY_SCHEMA, investigationId, { origin: INSIGHTS_ORIGIN });

  if (lens.status === 'loading') {
    return <Progress text={t('dashboard.insights.investigation.summarizing', 'Summarizing the investigation…')} />;
  }
  if (lens.status === 'error') {
    return (
      <Text element="p" variant="bodySmall" color="secondary">
        {t('dashboard.insights.investigation.summary-error', 'Could not summarize the investigation: {{error}}', {
          error: lens.error.message,
        })}
      </Text>
    );
  }

  const { summary, rootCause, nextSteps } = lens.data;
  return (
    <Stack direction="column" gap={1}>
      <Text element="p" variant="bodySmall">
        {summary}
      </Text>
      {rootCause && (
        <div>
          <Text variant="bodySmall" weight="medium">
            <Trans i18nKey="dashboard.insights.investigation.root-cause">Likely cause</Trans>
          </Text>
          <Text element="p" variant="bodySmall" color="secondary">
            {rootCause}
          </Text>
        </div>
      )}
      {nextSteps.length > 0 && (
        <div>
          <Text variant="bodySmall" weight="medium">
            <Trans i18nKey="dashboard.insights.investigation.next-steps">Next steps</Trans>
          </Text>
          <ul className={styles.steps}>
            {nextSteps.map((step) => (
              <li key={step}>
                <Text variant="bodySmall" color="secondary">
                  {step}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Stack>
  );
}

function Progress({ text }: { text: string }) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Spinner size="sm" inline />
      <Text variant="bodySmall" color="secondary">
        {text}
      </Text>
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    steps: css({
      margin: 0,
      paddingLeft: theme.spacing(2),
    }),
  };
}
