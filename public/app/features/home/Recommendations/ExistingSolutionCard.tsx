import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

import { SolutionSparkline } from './SolutionSparkline';
import { type ExistingItem } from './types';

interface ExistingSolutionCardProps {
  existing: ExistingItem[];
  selected: ExistingItem;
  onSelect: (title: string) => void;
}

export function ExistingSolutionCard({ existing, selected, onSelect }: ExistingSolutionCardProps) {
  const styles = useStyles2(getStyles);

  const showStatsSparklineRow =
    selected.statsLoading || selected.sparklineLoading || selected.stats || selected.sparkline;

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
                      onSelect(item.title);
                    }}
                    component={item.title === selected.title ? SelectedCheck : undefined}
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
            {selected.subtitle && (
              <Text variant="bodySmall" color="secondary">
                {selected.subtitle}
              </Text>
            )}
          </Stack>
        </Stack>
      </Stack>

      <Stack direction="column" gap={2}>
        {showStatsSparklineRow && (
          <Stack direction="row" gap={2} alignItems="center">
            {(selected.statsLoading || selected.stats) && (
              <div className={styles.stats}>
                {selected.statsLoading ? (
                  <Stack direction="column" gap={0} data-testid="kubernetes-stats-skeleton">
                    <Skeleton width={96} height={28} />
                    <Skeleton width={72} />
                  </Stack>
                ) : (
                  selected.stats && (
                    <Stack direction="column" gap={0}>
                      <Text variant="h2" color="primary">
                        {selected.stats.primary}
                      </Text>
                      <Text variant="body" color="secondary">
                        {selected.stats.secondary}
                      </Text>
                    </Stack>
                  )
                )}
              </div>
            )}

            {selected.sparklineLoading ? (
              <div className={styles.sparklineArea} data-testid="kubernetes-sparkline-skeleton">
                <Skeleton height={56} />
              </div>
            ) : (
              selected.sparkline && (
                <div className={styles.sparklineArea}>
                  <SolutionSparkline sparkline={selected.sparkline} />
                </div>
              )
            )}
          </Stack>
        )}

        {selected.alert && (
          <div className={styles.alert}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Icon name="exclamation-triangle" size="md" className={styles.warning} />

              <div className={cx(styles.metaRow, styles.alertText)}>
                <span className={styles.segment}>
                  <Text variant="body" color="primary">
                    {selected.alert.primary}
                  </Text>
                </span>
                {selected.alert.details?.map((segment, i) => (
                  <span key={i} className={styles.segment}>
                    <Text variant="body" color="secondary">
                      {segment}
                    </Text>
                  </span>
                ))}
              </div>

              <LinkButton
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-right"
                iconPlacement="right"
                href={selected.alert.href}
                onClick={() =>
                  ctaClicked({
                    surface: 'existing_solution',
                    action: 'view_alerts',
                    placement: 'card',
                    solution: selected.id,
                  })
                }
              >
                {selected.alert.action}
              </LinkButton>
            </Stack>
          </div>
        )}
      </Stack>

      <Stack direction="row" alignItems="center">
        <LinkButton
          variant="secondary"
          size="md"
          fill="solid"
          icon="arrow-right"
          iconPlacement="right"
          href={selected.href}
          onClick={() =>
            ctaClicked({
              surface: 'existing_solution',
              action: 'open_solution',
              placement: 'card',
              solution: selected.id,
            })
          }
        >
          {selected.action}
        </LinkButton>
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
  stats: css({
    flexShrink: 0,
  }),
  sparklineArea: css({
    flex: '1 1 auto',
    minWidth: 0,
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
});
