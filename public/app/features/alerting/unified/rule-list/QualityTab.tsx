import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Card, EmptyState, LinkButton, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { type IncompleteRule, useIncompleteRules } from '../hooks/useIncompleteRules';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';
import { Annotation, annotationLabels } from '../utils/constants';
import { createRelativeUrl } from '../utils/url';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

// A missing runbook URL leaves responders with nowhere to start, so it's treated as a
// high-severity issue and costs a full point. A missing summary/description is medium and
// costs half a point. The score sums these penalties across all rules, so all-rules-missing
// a runbook bottoms out at 0%, while only-summary/description gaps floor around 50%.
const HIGH_SEVERITY_WEIGHT = 1;
const MEDIUM_SEVERITY_WEIGHT = 0.5;

function isHighSeverity(rule: IncompleteRule): boolean {
  return rule.missing.includes(Annotation.runbookURL);
}

function ruleWeight(rule: IncompleteRule): number {
  return isHighSeverity(rule) ? HIGH_SEVERITY_WEIGHT : MEDIUM_SEVERITY_WEIGHT;
}

// Ranks rules for sorting: high-severity (missing a runbook URL) always sorts above
// medium, and within a tier, rules missing more fields sort first. Higher = more severe.
function severityRank(rule: IncompleteRule): number {
  const tier = isHighSeverity(rule) ? 1000 : 0;
  return tier + rule.missing.length;
}

// Score on a 0–10 scale, rounded to one decimal.
function qualityScore(rules: IncompleteRule[], total: number): number {
  if (total === 0) {
    return 10;
  }
  const penalty = rules.reduce((sum, rule) => sum + ruleWeight(rule), 0);
  const raw = Math.max(0, 10 * (1 - penalty / total));
  return Math.round(raw * 10) / 10;
}

function QualityTab() {
  const { navId, pageNav } = useAlertRulesNav();
  const { rules: flaggedRules, totalRules, isLoading } = useIncompleteRules();

  const incompleteCount = flaggedRules.length;
  const score = qualityScore(flaggedRules, totalRules);

  // Show the most severe rules first; ties broken by folder/group/name so the order is stable.
  const sortedRules = [...flaggedRules].sort((a, b) => {
    const diff = severityRank(b) - severityRank(a);
    if (diff !== 0) {
      return diff;
    }
    return `${a.folder}/${a.group}/${a.name}`.localeCompare(`${b.folder}/${b.group}/${b.name}`);
  });

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      isLoading={isLoading}
      actions={
        incompleteCount > 0 ? (
          <Tooltip
            content={t(
              'alerting.quality.fix-all-tooltip',
              'Automatically generate descriptions and summaries for all flagged rules.'
            )}
          >
            <Button icon="bolt" variant="primary">
              <Trans i18nKey="alerting.quality.fix-all">Fix all with AI</Trans>
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      <Stack direction="column" gap={2}>
        <QualityScoreCard score={score} incompleteCount={incompleteCount} totalRules={totalRules} />

        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.quality.description">
            These alert rules are missing a summary, description, or runbook URL. Select <strong>Edit</strong> on a rule
            to add the missing details — or use <strong>Fix with AI</strong> to generate them automatically, so
            responders know what fired and what to do.
          </Trans>
        </Text>

        {incompleteCount === 0 && !isLoading ? (
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
            {sortedRules.map((rule) => (
              <Card key={`${rule.folder}-${rule.group}-${rule.name}`}>
                <Card.Heading>{rule.name}</Card.Heading>
                <Card.Meta>{[rule.folder, rule.group].filter(Boolean)}</Card.Meta>
                <Card.Tags>
                  {isHighSeverity(rule) ? (
                    <Badge
                      color="red"
                      icon="exclamation-triangle"
                      text={t('alerting.quality.severity-high', 'High piority')}
                    />
                  ) : (
                    <Badge
                      color="orange"
                      icon="exclamation-circle"
                      text={t('alerting.quality.severity-medium', 'Medium priority')}
                    />
                  )}
                </Card.Tags>
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
                    content={t(
                      'alerting.quality.fix-tooltip',
                      'Automatically generate a description and summary for this rule.'
                    )}
                  >
                    <Button icon="bolt" variant="primary" size="sm">
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

interface QualityScoreCardProps {
  score: number;
  incompleteCount: number;
  totalRules: number;
}

function QualityScoreCard({ score, incompleteCount, totalRules }: QualityScoreCardProps) {
  const styles = useStyles2(getStyles, score);

  return (
    <div className={styles.card}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Text variant="h4">
            <Trans i18nKey="alerting.quality.score-title">Alert quality score</Trans>
          </Text>
          <span className={styles.score}>{score.toFixed(1)} / 10</span>
        </Stack>
        <div className={styles.track} role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={10}>
          <div className={styles.fill} />
        </div>
        <Text color="secondary" variant="bodySmall">
          <Trans
            i18nKey="alerting.quality.incomplete-summary"
            values={{ incomplete: incompleteCount, total: totalRules }}
          >
            {'{{incomplete}}'} of {'{{total}}'} alert rules need attention
          </Trans>
        </Text>
      </Stack>
    </div>
  );
}

function scoreColor(theme: GrafanaTheme2, score: number): string {
  // Color by thirds on the 0–10 scale: red (0–3.3), yellow (3.3–6.6), green (6.6–10).
  if (score >= 6.6) {
    return theme.colors.success.main;
  }
  if (score >= 3.3) {
    return theme.colors.warning.main;
  }
  return theme.colors.error.main;
}

const getStyles = (theme: GrafanaTheme2, score: number) => ({
  card: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  score: css({
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    color: scoreColor(theme, score),
  }),
  track: css({
    width: '100%',
    height: theme.spacing(1.5),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.pill,
    overflow: 'hidden',
  }),
  fill: css({
    width: `${score * 10}%`,
    height: '100%',
    backgroundColor: scoreColor(theme, score),
    transition: 'width 0.3s ease',
  }),
});

export default withPageErrorBoundary(QualityTab);
