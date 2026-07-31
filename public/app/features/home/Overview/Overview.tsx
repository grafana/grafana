import { css } from '@emotion/css';
import { Fragment, useMemo, useState, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type IconName, Button, Icon, Stack, Text, Dropdown, Menu, useTheme2, useStyles2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { ctaClicked } from '../analytics/main';

import { GetStarted } from './GetStarted';
import { useGuides } from './useGuides';

const HOME_OVERVIEW_OPTION_LOCAL_STORAGE_KEY = 'grafana.home.overview.option';

interface Option {
  value: string;
  label: string;
  icon?: IconName;
  highlight?: boolean;
  content: ReactNode;
}

export function Overview() {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const guides = useGuides();

  const options = useMemo<Option[]>(
    () => [
      {
        value: 'all',
        label: t('home.overview.options.all', 'All solutions'),
        content: <></>,
      },
      {
        value: 'attention',
        label: t('home.overview.options.attention', 'Needs attention'),
        content: <></>,
      },
      {
        value: 'enabled',
        label: t('home.overview.options.enabled', 'Enabled solutions'),
        content: <></>,
      },
      {
        value: 'available',
        label: t('home.overview.options.available', 'Available solutions'),
        content: <></>,
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
    [guides]
  );
  const [stored, setStored] = useStoredString(HOME_OVERVIEW_OPTION_LOCAL_STORAGE_KEY, options[0].value);
  const option = useMemo(() => options.find((o) => o.value === stored) ?? options[0], [options, stored]);

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
    <div>
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
    </div>
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
