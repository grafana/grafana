import { css } from '@emotion/css';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type IconName, Button, Icon, Stack, Text, Dropdown, Menu, useTheme2, useStyles2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { ctaClicked } from '../analytics/main';
import { type Solution } from '../solutions/types';

import { GetStarted } from './GetStarted';
import { Solutions } from './Solutions';
import { groupOverviewCards, resolveOverviewCards } from './solutionGroups';
import { useGuides } from './useGuides';

const HOME_OVERVIEW_OPTION_LOCAL_STORAGE_KEY = 'grafana.home.overview.option';

interface Option {
  value: string;
  label: string;
  icon?: IconName;
  highlight?: boolean;
  content: ReactNode;
}

interface OverviewProps {
  solutions: Solution[];
}

export function Overview({ solutions }: OverviewProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const guides = useGuides();
  const { value: cards, loading: cardsLoading } = useAsync(() => resolveOverviewCards(solutions), [solutions]);
  const groups = useMemo(() => groupOverviewCards(cards ?? []), [cards]);

  const options = useMemo<Option[]>(
    () => [
      {
        value: 'all-solutions',
        label: t('home.overview.options.all', 'All solutions'),
        content: (
          <Solutions
            loading={cardsLoading}
            cards={cards ?? []}
            emptyMessage={t('home.overview.empty.all', 'No solutions were found.')}
          />
        ),
      },
      {
        value: 'needs-attention',
        label: t('home.overview.options.attention', 'Needs attention'),
        content: (
          <Solutions
            loading={cardsLoading}
            cards={groups.attention}
            emptyMessage={t('home.overview.empty.attention', 'No solutions need attention.')}
          />
        ),
      },
      {
        value: 'enabled-solutions',
        label: t('home.overview.options.enabled', 'Enabled solutions'),
        content: (
          <Solutions
            loading={cardsLoading}
            cards={groups.enabled}
            emptyMessage={t('home.overview.empty.enabled', 'No enabled solutions with recent activity were found.')}
          />
        ),
      },
      {
        value: 'available-solutions',
        label: t('home.overview.options.available', 'Available solutions'),
        content: (
          <Solutions
            loading={cardsLoading}
            cards={groups.available}
            emptyMessage={t('home.overview.empty.available', 'No available solutions to show yet.')}
          />
        ),
      },
      // Hide get started if there are no guides to show, but do show it while loading
      ...(!guides || guides.length > 0
        ? [
            {
              value: 'get-started',
              label: t('home.overview.options.get-started', 'Get started'),
              icon: 'rocket' as const,
              highlight: true,
              content: <GetStarted guides={guides} />,
            },
          ]
        : []),
    ],
    [cards, cardsLoading, groups, guides]
  );
  const [stored, setStored] = useStoredString(HOME_OVERVIEW_OPTION_LOCAL_STORAGE_KEY, options[0].value);
  const option = useMemo(() => options.find((o) => o.value === stored) ?? options[0], [options, stored]);

  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // Handle each hash value once: `options` rebuilds as cards and guides settle, and re-running
  // the match would re-scroll the page and override a filter the user picked in the meantime.
  const handledHash = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (location.hash === handledHash.current) {
      return;
    }
    // Record even without a match so clearing the hash re-arms the same anchor for a later visit.
    handledHash.current = location.hash;
    const match = options.find((o) => o.value === location.hash.slice(1));
    if (match) {
      setStored(match.value);
      ref.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [options, location.hash, setStored]);

  const menu = useMemo(
    () => (
      <Menu>
        {options.map(({ value, label, icon, highlight }) => (
          <Fragment key={value}>
            {highlight && <Menu.Divider />}
            <Menu.Item
              icon={icon}
              iconColor={
                highlight
                  ? theme.flags.visualDesignRefresh
                    ? theme.colors.accent.main
                    : theme.visualization.getColorByName('orange')
                  : undefined
              }
              className={highlight ? styles.highlight : undefined}
              label={label}
              onClick={() => {
                setStored(value);
                // The hash is a one-shot deep link and nothing else on this route reads
                // fragments, so an explicit pick clears whatever anchor is present — including
                // typo'd or outdated ones that would otherwise linger looking broken.
                const current = locationService.getLocation();
                if (current.hash) {
                  locationService.replace({ ...current, hash: '' });
                }
                ctaClicked({
                  surface: 'overview',
                  action: 'change_overview_filter',
                  placement: 'menu',
                  solution: value,
                });
              }}
              active={option.value === value}
            />
          </Fragment>
        ))}
      </Menu>
    ),
    [options, option.value, setStored, theme, styles]
  );
  const [open, setOpen] = useState(false);

  return (
    <Stack direction="column" gap={2} ref={ref}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" columnGap={2} rowGap={1} wrap="wrap">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.overview.title">Your observability stack overview</Trans>
        </Text>

        <Dropdown overlay={menu} onVisibleChange={setOpen} placement="bottom-end">
          <Button variant="secondary" size="md">
            <Stack direction="row" alignItems="center" columnGap={1}>
              {option.icon && (
                <Icon
                  name={option.icon}
                  color={
                    theme.flags.visualDesignRefresh
                      ? theme.colors.accent.main
                      : theme.visualization.getColorByName('orange')
                  }
                />
              )}
              {option.label}
              <Icon name={open ? 'angle-up' : 'angle-down'} />
            </Stack>
          </Button>
        </Dropdown>
      </Stack>

      {option.content}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  highlight: css({
    background: 'none',
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',

    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      inset: 0,
      background: theme.colors.gradients.brandHorizontal,
      opacity: 0.125,
      pointerEvents: 'none',
      zIndex: -1,
    },
  }),
});
