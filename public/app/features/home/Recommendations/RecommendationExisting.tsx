import { css } from '@emotion/css';
import { useState } from 'react';

import { type IconName, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';

interface ExistingItem {
  title: string;
  icon: IconName;
  stats: {
    primary: string;
    secondary: string;
  };
  alert: {
    primary: string;
    secondary: string;
    action: string;
    href: string;
  };
  action: string;
  href: string;
}

const existing: ExistingItem[] = [
  {
    title: 'Kubernetes Monitoring',
    icon: 'kubernetes',
    stats: {
      primary: '3 clusters',
      secondary: '247 pods',
    },
    alert: {
      primary: '2 alerts firing',
      secondary: 'payments-api · 14 pod restarts in the last hour',
      action: 'View',
      href: '#',
    },
    action: 'Open K8s app',
    href: '#',
  },
  {
    title: 'Hosted Metrics',
    icon: 'chart-line',
    stats: {
      primary: '4.2M series',
      secondary: '12 hosts',
    },
    alert: {
      primary: '3 hosts above 90% disk',
      secondary: 'web-03 critical at 96% — ~6 h to full',
      action: 'View',
      href: '#',
    },
    action: 'Open infrastructure',
    href: '#',
  },
  {
    title: 'Hosted Logs',
    icon: 'file-alt',
    stats: {
      primary: '47 GB ingested',
      secondary: '8 sources',
    },
    alert: {
      primary: 'Ingest spike detected',
      secondary: 'checkout-service logs up 3x in the last hour',
      action: 'View',
      href: '#',
    },
    action: 'Open Explore (Logs)',
    href: '#',
  },
];

export default function RecommendationExisting() {
  const styles = useStyles2(getStyles);
  const [selected, setSelected] = useState(existing[0]);

  if (!selected) {
    return null;
  }

  return (
    <Stack direction="column" justifyContent="space-between" gap={2} flex={1}>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Group label={t('home.recommendations.switch', 'Switch to another app you run')}>
              {existing.map((item) => (
                <Menu.Item
                  key={item.title}
                  label={item.title}
                  icon={item.icon}
                  onClick={() => setSelected(item)}
                  active={item === selected}
                />
              ))}
            </Menu.Group>
          </Menu>
        }
      >
        <Button variant="secondary" fill="text" className={styles.dropdown}>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles.icon}>
              <Icon name={selected.icon} size="lg" />
            </div>

            <Stack direction="column" gap={0}>
              <Text variant="bodySmall" color="secondary">
                <span className={styles.subtitle}>
                  <Trans i18nKey="home.recommendations.existing">Enabled solution</Trans>
                </span>
              </Text>

              <Stack direction="row" gap={0.5} alignItems="center">
                <Text variant="h4" color="primary" role="heading" aria-level={3}>
                  {selected.title}
                </Text>

                <Icon name="angle-down" className={styles.chevron} />
              </Stack>
            </Stack>
          </Stack>
        </Button>
      </Dropdown>

      <Stack direction="column" gap={2}>
        <Stack direction="row" alignItems="baseline" columnGap={0.5} rowGap={0} wrap="wrap">
          <Text variant="h2" color="primary">
            {selected.stats.primary}
          </Text>

          <Text variant="body" color="secondary">
            &middot; {selected.stats.secondary}
          </Text>
        </Stack>

        <div className={styles.alert}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name="exclamation-triangle" size="md" className={styles.warning} />

            <Stack direction="row" alignItems="center" columnGap={0.5} rowGap={0} flex="1 1 auto" wrap="wrap">
              <Text variant="body" color="primary">
                {selected.alert.primary}
              </Text>

              <Text variant="body" color="secondary">
                &middot; {selected.alert.secondary}
              </Text>
            </Stack>

            <LinkButton
              variant="secondary"
              size="sm"
              fill="text"
              icon="angle-right"
              iconPlacement="right"
              href={selected.alert.href}
            >
              {selected.alert.action}
            </LinkButton>
          </Stack>
        </div>
      </Stack>

      <Stack direction="row" alignItems="center" gap={1}>
        <LinkButton
          variant="secondary"
          size="md"
          fill="solid"
          icon="arrow-right"
          iconPlacement="right"
          href={selected.href}
        >
          {selected.action}
        </LinkButton>
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dropdown: css({
    alignSelf: 'flex-start',
    height: 'auto',
    padding: theme.spacing(1),
    margin: theme.spacing(-1),
    textAlign: 'left',

    '&:hover': {
      borderColor: theme.colors.border.medium,
    },
  }),
  chevron: css({
    color: theme.colors.text.secondary,

    '[aria-expanded="true"] &': {
      transform: 'rotate(180deg)',
    },
  }),
  icon: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    padding: theme.spacing(1.5),
    lineHeight: 0,
  }),
  subtitle: css({
    textTransform: 'uppercase',
    letterSpacing: theme.spacing(0.125),
    opacity: 0.75,
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
