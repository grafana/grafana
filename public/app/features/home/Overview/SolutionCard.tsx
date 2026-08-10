import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Card, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';
import { LearnMoreLink } from '../solutions/LearnMoreLink';
import { SolutionStatsRow } from '../solutions/SolutionStatsRow';
import { type Solution, type SolutionOffer } from '../solutions/model';

interface SolutionCardProps {
  solution: Solution;
  needsAttention: boolean;
}

export function SolutionCard({ solution, needsAttention }: SolutionCardProps) {
  const { value: alert = null } = useAsync(
    async () => (needsAttention ? solution.alert() : null),
    [needsAttention, solution]
  );
  const { value: cta = null, loading: ctaLoading } = useAsync(() => solution.cta(), [solution]);
  const styles = useStyles2(getStyles, needsAttention);
  const status = needsAttention
    ? t('home.overview.status.attention', 'Needs attention')
    : t('home.overview.status.enabled', 'Enabled');

  return (
    <Card noMargin className={styles.card}>
      <Card.Heading>
        <Stack direction="row" gap={1.5} alignItems="center">
          <div className={styles.icon}>
            <Icon name={solution.icon} size="lg" />
          </div>
          <Stack direction="column" gap={0}>
            <Text element="h3" variant="h5">
              {solution.title}
            </Text>
            <Stack direction="row" gap={1} alignItems="center">
              <span className={styles.statusDot} aria-hidden="true" />
              <Text variant="bodySmall" color="secondary">
                {status}
              </Text>
            </Stack>
          </Stack>
        </Stack>
      </Card.Heading>

      <Card.Description className={styles.content}>
        <SolutionStatsRow
          stats={solution.stats}
          refinedStats={solution.refinedStats}
          sparkline={solution.sparkline}
          gap={3}
        />

        {alert && (
          <Stack direction="row" gap={1.5} alignItems="flex-start">
            <Icon name="exclamation-triangle" size="md" className={styles.warning} />
            <Stack direction="column" gap={0.5} alignItems="flex-start" flex={1}>
              <Text variant="body" color="secondary">
                {[alert.primary, ...(alert.details ?? [])].join(' · ')}
              </Text>
              {alert.cta && (
                <LinkButton
                  href={alert.cta.href}
                  variant="secondary"
                  size="sm"
                  fill="text"
                  icon="angle-right"
                  iconPlacement="right"
                  className={styles.alertAction}
                  onClick={() =>
                    ctaClicked({
                      surface: 'overview',
                      action: 'view_alerts',
                      placement: 'card',
                      solution: solution.id,
                    })
                  }
                >
                  {alert.cta.label}
                </LinkButton>
              )}
            </Stack>
          </Stack>
        )}
      </Card.Description>

      <Card.Actions>
        {ctaLoading ? (
          <Skeleton width={120} height={24} />
        ) : cta ? (
          <LinkButton
            href={cta.href}
            variant="secondary"
            fill="text"
            icon="angle-right"
            iconPlacement="right"
            onClick={() =>
              ctaClicked({ surface: 'overview', action: 'open_solution', placement: 'card', solution: solution.id })
            }
          >
            {cta.label}
          </LinkButton>
        ) : null}
      </Card.Actions>
    </Card>
  );
}

interface AvailableSolutionCardProps {
  solution: Solution;
  offer: SolutionOffer;
}

export function AvailableSolutionCard({ solution, offer }: AvailableSolutionCardProps) {
  const styles = useStyles2(getStyles, false);
  const status =
    offer.availability === 'enable'
      ? t('home.overview.status.available', 'Not enabled')
      : t('home.overview.status.setup', 'Ready to configure');

  return (
    <Card noMargin className={styles.card}>
      <Card.Heading>
        <Stack direction="row" gap={1.5} alignItems="center">
          <div className={styles.availableIcon}>
            <Icon name={solution.icon} size="lg" />
          </div>
          <Stack direction="column" gap={0}>
            <Text element="h3" variant="h5">
              {solution.title}
            </Text>
            <Text variant="bodySmall" color="secondary">
              {status}
            </Text>
          </Stack>
        </Stack>
      </Card.Heading>

      <Card.Description className={styles.availableContent}>
        <Text variant="body" color="secondary">
          {offer.description}
        </Text>
        {offer.setupHint && <Badge color="darkgrey" text={offer.setupHint} className={styles.setupHint} />}
      </Card.Description>

      {(offer.cta || offer.learnMore) && (
        <Card.Actions>
          {offer.cta && (
            <LinkButton
              href={offer.cta.href}
              variant="secondary"
              size="sm"
              onClick={() =>
                ctaClicked({
                  surface: 'overview',
                  action: offer.availability,
                  placement: 'card',
                  solution: solution.id,
                })
              }
            >
              {offer.cta.label}
            </LinkButton>
          )}
          {offer.learnMore && (
            <LearnMoreLink
              {...offer.learnMore}
              onClick={() =>
                ctaClicked({ surface: 'overview', action: 'learn_more', placement: 'card', solution: solution.id })
              }
            />
          )}
        </Card.Actions>
      )}
    </Card>
  );
}

export function SolutionCardSkeleton() {
  const styles = useStyles2(getStyles, false);

  return (
    <Card noMargin className={styles.card}>
      <Card.Heading>
        <Stack direction="row" gap={1.5} alignItems="center">
          <Skeleton width={44} height={44} />
          <Stack direction="column" gap={0}>
            <Skeleton width={180} height={20} />
            <Skeleton width={80} />
          </Stack>
        </Stack>
      </Card.Heading>
      <Card.Description className={styles.content}>
        <Skeleton width={130} height={32} />
        <Skeleton width="100%" height={20} />
      </Card.Description>
      <Card.Actions>
        <Skeleton width={140} height={24} />
      </Card.Actions>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2, needsAttention: boolean) => ({
  card: css({
    height: '100%',
    minHeight: theme.spacing(30),
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.weak}`,
    ...(needsAttention && {
      borderColor: `color-mix(in srgb, ${theme.colors.warning.main} 32%, ${theme.colors.border.weak})`,
      overflow: 'hidden',

      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: theme.spacing(0.375),
        background: theme.colors.warning.main,
      },
    }),
  }),
  icon: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    width: theme.spacing(6),
    height: theme.spacing(6),
  }),
  availableIcon: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    width: theme.spacing(6),
    height: theme.spacing(6),
  }),
  statusDot: css({
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.circle,
    background: needsAttention ? theme.colors.warning.main : theme.colors.success.main,
    flexShrink: 0,
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  availableContent: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  }),
  setupHint: css({
    background: 'transparent',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.pill,
    color: theme.colors.text.disabled,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.pxToRem(11),
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.pxToRem(17),
    padding: theme.spacing(0.25, 1),
    whiteSpace: 'nowrap',
  }),
  warning: css({
    color: theme.colors.warning.main,
    flexShrink: 0,
  }),
  alertAction: css({
    color: theme.colors.warning.text,

    '&:hover, &:focus': {
      background: theme.colors.warning.background,
      color: theme.colors.warning.textEmphasis,
    },
  }),
});
