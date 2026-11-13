import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useUserStorage } from '@grafana/runtime/internal';
import { Button, Divider, Icon, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { CloudBadge } from 'app/core/components/Branding/CloudBadge';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';

import { ContentBox } from './ContentBox';

type AdCardProps = {
  title: string;
  description: string;
  href: string;
  logoUrl: string;
  items: string[];
  storageKey: string;
  /** Same content in less space: smaller logo, no dividers, items in a tighter grid. */
  compact?: boolean;
};

export default function AdCard({ title, description, href, logoUrl, items, storageKey, compact = false }: AdCardProps) {
  const styles = useStyles2(getAddCardStyles);
  const storage = useUserStorage('grafana-help-flags');
  const [isDismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    storage.getItem(storageKey).then((value: string | null) => {
      setDismissed(value === 'true');
    });
  }, [storage, storageKey]);

  const onDismiss = async () => {
    await storage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  if (isDismissed || !isOpenSourceBuildOrUnlicenced()) {
    return null;
  }

  const learnMore = (
    <Button
      fill="solid"
      variant="secondary"
      size={compact ? 'sm' : 'md'}
      onClick={() => window.open(href, '_blank')}
      className={styles.button}
    >
      <Trans i18nKey="alerting.ad.learn-more">Learn more</Trans>
      <Icon name="external-link-alt" className={styles.buttonIcon} />
    </Button>
  );

  const itemList = (
    <div className={compact ? styles.compactItemsList : styles.itemsList}>
      {items.map((item) => (
        <div key={item} className={styles.listItem}>
          <Icon className={styles.icon} name="check" />
          {item}
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <ContentBox title={title} flex={1} padding={1.5}>
        <Stack direction="column" gap={1}>
          <header className={styles.compactHeader}>
            <img src={logoUrl} alt={title.concat(' logo')} className={styles.compactLogo} />
            <Stack direction="column" gap={0} flex={1}>
              <Stack gap={1} alignItems="center">
                <Text element="h3" variant="h5">
                  {title}
                </Text>
                <CloudBadge />
              </Stack>
              <Text color="secondary" variant="bodySmall">
                {description}
              </Text>
            </Stack>
            {learnMore}
            <IconButton name="times" size="sm" onClick={onDismiss} aria-label={t('alerting.ad.close', 'Close')} />
          </header>
          {itemList}
        </Stack>
      </ContentBox>
    );
  }

  return (
    <ContentBox title={title} flex={1}>
      <div className={styles.preHeader}>
        <CloudBadge />
        <IconButton name="times" size="sm" onClick={onDismiss} aria-label={t('alerting.ad.close', 'Close')} />
      </div>
      <header className={styles.header}>
        <img src={logoUrl} alt={title.concat(' logo')} className={styles.logo} />
        <Stack direction="column" gap={1} flex={1}>
          <Text element="h3" variant="h4">
            {title}
          </Text>
          <Text element="p" color="secondary">
            {description}
          </Text>
        </Stack>
      </header>
      <Divider />
      {itemList}
      <Divider />
      {learnMore}
    </ContentBox>
  );
}

const getAddCardStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    objectFit: 'contain',
    width: '47px',
    height: '47px',
  }),

  header: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
    minHeight: theme.spacing(8),
  }),

  itemsList: css({
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(0.5),
    [theme.breakpoints.up('xl')]: {
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing(1),
    },
  }),

  listItem: css({
    display: 'flex',
    alignItems: 'flex-start',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.bodySmall.lineHeight,
    marginBottom: theme.spacing(0.5),
  }),

  icon: css({
    marginRight: theme.spacing(1),
    color: theme.colors.success.main,
  }),

  button: css({
    padding: `0 ${theme.spacing(2)}`,
  }),

  buttonIcon: css({
    marginLeft: theme.spacing(1),
  }),

  compactLogo: css({
    objectFit: 'contain',
    width: '28px',
    height: '28px',
  }),

  compactHeader: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  }),

  compactItemsList: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    columnGap: theme.spacing(2),
  }),

  preHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
});
