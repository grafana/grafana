import { css } from '@emotion/css';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Card, Icon, LinkButton, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { GrotCompleted, GrotCTA, GrotNotFound } from '@grafana/ui/internal';

export function HomeGoalSuggestions({ onSelect }: { onSelect?: (title: string) => void }) {
  const styles = useStyles2(getStyles);
  const { isAvailable, isLoading, openAssistant } = useAssistant();
  const canOpenAssistant = isAvailable && openAssistant != null;
  const goals = [
    {
      id: 'discover',
      title: t('home.goals.discover-title', 'Discover more of Grafana'),
      description: t(
        'home.goals.discover-description',
        'Find Grafana products you could be making more use of across your repositories.'
      ),
      prompt: t(
        'home.goals.discover-prompt',
        'Review my connected repositories and identify Grafana products we are underutilising. Explain where each product could help and suggest a practical first step, based on the evidence you find.'
      ),
      Illustration: GrotNotFound,
    },
    {
      id: 'coverage',
      title: t('home.goals.coverage-title', 'Find monitoring gaps'),
      description: t(
        'home.goals.coverage-description',
        'Spot services that need better metrics, logs, traces or synthetic checks.'
      ),
      prompt: t(
        'home.goals.coverage-prompt',
        'Review my connected repositories for gaps in metrics, logs, traces and synthetic monitoring. Prioritise the most useful improvements and explain how to get started with Grafana.'
      ),
      Illustration: GrotCTA,
    },
    {
      id: 'reliability',
      title: t('home.goals.reliability-title', 'Improve service reliability'),
      description: t(
        'home.goals.reliability-description',
        'Find opportunities for clearer alerts and meaningful service goals.'
      ),
      prompt: t(
        'home.goals.reliability-prompt',
        'Review my connected repositories and suggest how to improve service reliability with Grafana alerting and SLOs. Identify the most important services, recommend useful signals and explain what to tackle first.'
      ),
      Illustration: GrotCompleted,
    },
  ];

  return (
    <section className={styles.content} aria-label={t('home.goals.label', 'Suggested goals')}>
      <p className={styles.introduction}>
        {t(
          'home.goals.introduction',
          'Choose a goal to work towards. Add your repository and define success, then get help deciding what to do next.'
        )}
      </p>
      {!onSelect && isLoading && <LoadingPlaceholder text={t('home.goals.loading', 'Loading Grafana Assistant…')} />}
      {!onSelect && !isLoading && !canOpenAssistant && (
        <Alert severity="info" title={t('home.goals.unavailable', 'Grafana Assistant is needed to start a goal')}>
          <LinkButton href="/plugins/grafana-assistant-app" variant="secondary">
            {t('home.goals.view-assistant', 'View Grafana Assistant')}
          </LinkButton>
        </Alert>
      )}
      <div className={styles.grid}>
        {goals.map(({ id, title, description, prompt, Illustration }) => (
          <Card
            key={id}
            className={styles.goal}
            disabled={!onSelect && (isLoading || !canOpenAssistant)}
            onClick={() =>
              onSelect ? onSelect(title) : openAssistant?.({ origin: 'grafana/home/goal', prompt, autoSend: false })
            }
            noMargin
          >
            <Card.Figure className={styles.figure}>
              <div aria-hidden="true" className={styles.illustration}>
                <Illustration width={140} height={110} />
              </div>
            </Card.Figure>
            <Card.Heading>{title}</Card.Heading>
            <Card.Description>{description}</Card.Description>
            <Card.Meta>
              <span className={styles.action}>
                {t('home.goals.use-goal', 'Add that goal')} <Icon name="arrow-right" />
              </span>
            </Card.Meta>
          </Card>
        ))}
      </div>
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({ width: '100%', minWidth: 0 }),
  introduction: css({
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing(4),
    textWrap: 'balance',
  }),
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: theme.spacing(2),
  }),
  goal: css({
    gridTemplateAreas: '"Figure" "Heading" "Description" "Meta"',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'auto auto 1fr auto',
    padding: theme.spacing(3),
    gap: theme.spacing(2),
    overflowWrap: 'anywhere',
  }),
  illustration: css({ display: 'flex', alignItems: 'center', height: 110 }),
  figure: css({ width: '100%', marginRight: 0 }),
  action: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(1) }),
});
