import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';
import { SolutionStatsRow } from '../solutions/SolutionStatsRow';
import { type Solution, type SolutionId } from '../solutions/types';

interface ExistingSolutionCardProps {
  existing: Solution[];
  selected: Solution;
  onSelect: (id: SolutionId) => void;
}

export function ExistingSolutionCard({ existing, selected, onSelect }: ExistingSolutionCardProps) {
  const styles = useStyles2(getStyles);

  const { value: alert = null } = useAsync(() => selected.alert(), [selected]);
  const { value: cta = null, loading: ctaLoading } = useAsync(() => selected.cta(), [selected]);
  const { value: datasource = null } = useAsync(() => selected.datasource(), [selected]);
  const subtitle = datasource && t('home.solutions.via-datasource', 'via {{name}}', { name: datasource.name });
  const isAttentionCta = cta?.action === 'view_alerts';

  return (
    <Stack direction="column" justifyContent="space-between" gap={2} flex={1}>
      <Stack direction="column" gap={1.5}>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Group label={t('home.recommendations.switch', 'Recommendations follow the selected solution')}>
                {existing.map((item) => (
                  <Menu.Item
                    key={item.title}
                    label={item.title}
                    icon={item.icon}
                    onClick={() => {
                      // Re-picking the current solution is a no-op, not a switch.
                      if (item.id !== selected.id) {
                        ctaClicked({
                          surface: 'existing_solution',
                          action: 'switch_solution',
                          placement: 'card',
                          solution: item.id,
                        });
                      }
                      onSelect(item.id);
                    }}
                    component={item.id === selected.id ? SelectedCheck : undefined}
                  />
                ))}
              </Menu.Group>
            </Menu>
          }
        >
          <Button variant="secondary" fill="outline" size="sm" className={styles.dropdown}>
            <Stack direction="row" alignItems="center">
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="home.recommendations.existing">Enabled solution</Trans>
              </Text>

              <Text variant="bodySmall" color="primary" weight="medium">
                <Trans i18nKey="home.recommendations.switchSolution">Switch solution</Trans>
              </Text>

              <Icon name="angle-down" className={styles.chevron} />
            </Stack>
          </Button>
        </Dropdown>

        <Stack direction="row" alignItems="center" gap={1.5}>
          <div className={styles.icon}>
            <Icon name={selected.icon} size="lg" />
          </div>

          <Stack direction="column" gap={0}>
            <Text variant="h3" color="primary" role="heading" aria-level={3}>
              {selected.title}
            </Text>
            {subtitle && (
              <Text variant="bodySmall" color="secondary">
                {subtitle}
              </Text>
            )}
          </Stack>
        </Stack>
      </Stack>

      <Stack direction="column" gap={2}>
        <SolutionStatsRow
          stats={selected.stats}
          refinedStats={selected.refinedStats}
          sparkline={selected.sparkline}
          statsTestId="solution-stats-skeleton"
          sparklineTestId="solution-sparkline-skeleton"
        />

        {alert && (
          <div className={styles.alert}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Icon name="exclamation-triangle" size="md" className={styles.warning} />

              <div className={cx(styles.metaRow, styles.alertText)}>
                <span className={styles.segment}>
                  <Text variant="body" color="primary">
                    {alert.primary}
                  </Text>
                </span>
                {alert.details?.map((segment, i) => (
                  <span key={i} className={styles.segment}>
                    <Text variant="body" color="secondary">
                      {segment}
                    </Text>
                  </span>
                ))}
              </div>
            </Stack>
          </div>
        )}
      </Stack>

      <Stack direction="row" alignItems="center">
        {ctaLoading ? (
          <Skeleton width={140} height={32} />
        ) : cta ? (
          <LinkButton
            variant="secondary"
            size={isAttentionCta ? 'sm' : 'md'}
            fill={isAttentionCta ? 'text' : 'solid'}
            icon={isAttentionCta ? 'angle-right' : 'arrow-right'}
            iconPlacement="right"
            href={cta.href}
            className={isAttentionCta ? cx(styles.textAction, styles.attentionAction) : undefined}
            onClick={() =>
              ctaClicked({
                surface: 'existing_solution',
                action: cta.action,
                placement: 'card',
                solution: selected.id,
              })
            }
          >
            {cta.label}
          </LinkButton>
        ) : null}
      </Stack>
    </Stack>
  );
}

// Marks the currently selected solution in the switch menu; the active row carries no highlight.
function SelectedCheck() {
  const styles = useStyles2(getStyles);
  return <Icon name="check" className={styles.selectedCheck} aria-hidden />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  metaRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing(1.5),
    rowGap: 0,
    overflow: 'hidden',
  }),
  alertText: css({
    flex: '1 1 auto',
    minWidth: 0,
  }),
  segment: css({
    position: 'relative',

    '&:not(:first-child)::before': {
      content: '"·"',
      position: 'absolute',
      left: theme.spacing(-1.25),
      color: theme.colors.text.secondary,
    },
  }),
  dropdown: css({
    alignSelf: 'flex-start',
    height: 'auto',
    padding: theme.spacing(0.75, 1.5),
  }),
  chevron: css({
    color: theme.colors.text.secondary,

    '[aria-expanded="true"] &': {
      transform: 'rotate(180deg)',
    },
  }),
  selectedCheck: css({
    position: 'absolute',
    right: theme.spacing(1.5),
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.action.selectedBorder,
  }),
  icon: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    padding: theme.spacing(1.5),
    lineHeight: 0,
  }),
  alert: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  warning: css({
    color: theme.colors.warning.main,
    margin: theme.spacing(0, 0, 0, 0.5),
  }),
  textAction: css({
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
  }),
  attentionAction: css({
    color: theme.colors.warning.text,

    '&:hover, &:focus': {
      background: theme.colors.warning.background,
      color: theme.colors.warning.textEmphasis,
    },
  }),
});
