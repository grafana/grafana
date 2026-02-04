import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { LinkButton, useStyles2, Alert, Badge, Stack, Tab, TabsBar, TabContent } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SECRETS_KEEPER_NEW_URL } from './constants';
import { useKeepers } from './hooks/useKeepers';
import { KeeperListItem } from './types';

export default function HomePage() {
  const { keepers, isLoading, error, activeKeeper } = useKeepers();
  const styles = useStyles2(getStyles);

  const tabInfo = useMemo(
    () => [
      {
        value: 'values',
        label: t('secrets.tabs.values', 'Values'),
        title: t('secrets.tabs.values-title', 'Manage secret values'),
        href: '/admin/secrets',
      },
      {
        value: 'keepers',
        label: t('secrets.tabs.keepers', 'Keepers'),
        title: t('secrets.tabs.keepers-title', 'Configure external secrets storage'),
        active: true,
      },
      // Placeholder for future
      // {
      //   value: 'audit',
      //   label: t('secrets.tabs.audit', 'Audit Logs'),
      //   title: t('secrets.tabs.audit-title', 'View secret access logs'),
      // },
    ],
    []
  );

  return (
    <Page navId="secrets-management" subTitle="Manage external secrets storage for Grafana">
      <Page.Contents isLoading={isLoading}>
        <Stack direction="column" gap={2}>
          <TabsBar>
            {tabInfo.map((tab) => (
              <Tab
                key={tab.value}
                label={tab.label}
                active={tab.active || false}
                href={tab.href}
                title={tab.title}
              />
            ))}
          </TabsBar>
          <TabContent>
            {/* Header with action */}
            <div className={styles.header}>
            <div>
              <h3>
                <Trans i18nKey="secrets-keeper.home.title">Secrets Keepers</Trans>
              </h3>
              {activeKeeper && (
                <div className={styles.activeInfo}>
                  <Trans i18nKey="secrets-keeper.home.active-keeper">
                    Active keeper: <strong>{activeKeeper.name}</strong> ({activeKeeper.type})
                  </Trans>
                </div>
              )}
            </div>
            <LinkButton href={SECRETS_KEEPER_NEW_URL} icon="plus" variant="primary">
              <Trans i18nKey="secrets-keeper.home.add-keeper">Add keeper</Trans>
            </LinkButton>
          </div>

          {/* Error state */}
          {error && (
            <Alert title={t('secrets-keeper.home.error-title', 'Error loading keepers')}>
              <Trans i18nKey="secrets-keeper.home.error">{error.message}</Trans>
            </Alert>
          )}

          {/* Empty state */}
          {!isLoading && keepers.length === 0 && (
            <Alert severity="info" title={t('secrets-keeper.home.empty-title', 'No keepers configured')}>
              <Trans i18nKey="secrets-keeper.home.empty-state">
                Secrets keepers allow you to store Grafana secrets in external services like AWS Secrets Manager, Azure
                Key Vault, GCP Secret Manager, or HashiCorp Vault.
              </Trans>
              <br />
              <br />
              <LinkButton href={SECRETS_KEEPER_NEW_URL} icon="plus">
                <Trans i18nKey="secrets-keeper.home.add-first-keeper">Add your first keeper</Trans>
              </LinkButton>
            </Alert>
          )}

            {/* Keepers list */}
            {keepers.length > 0 && (
              <div className={styles.list}>
                {keepers.map((keeper) => (
                  <KeeperCard key={keeper.name} keeper={keeper} />
                ))}
              </div>
            )}
          </TabContent>
        </Stack>
      </Page.Contents>
    </Page>
  );
}

interface KeeperCardProps {
  keeper: KeeperListItem;
}

function KeeperCard({ keeper }: KeeperCardProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            {keeper.name}
            {keeper.isActive && (
              <Badge
                text={t('secrets-keeper.home.active-badge', 'Active')}
                color="green"
                icon="check"
                className={styles.activeBadge}
              />
            )}
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.type}>{getKeeperTypeLabel(keeper.type)}</span>
            {keeper.config && (
              <>
                <span className={styles.separator}>•</span>
                <span className={styles.config}>{keeper.config}</span>
              </>
            )}
          </div>
        </div>
        <LinkButton href="#" variant="secondary" size="sm">
          <Trans i18nKey="secrets-keeper.home.view-details">View details</Trans>
        </LinkButton>
      </div>
      {keeper.description && <div className={styles.cardDescription}>{keeper.description}</div>}
    </div>
  );
}

function getKeeperTypeLabel(type: KeeperListItem['type']): string {
  const labels: Record<KeeperListItem['type'], string> = {
    aws: 'AWS Secrets Manager',
    azure: 'Azure Key Vault',
    gcp: 'GCP Secret Manager',
    hashicorp: 'HashiCorp Vault',
    system: 'System (Grafana)',
  };
  return labels[type];
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(2),
  }),
  activeInfo: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  card: css({
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      borderColor: theme.colors.border.medium,
    },
  }),
  cardHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  }),
  cardTitle: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  activeBadge: css({
    marginLeft: theme.spacing(1),
  }),
  cardMeta: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  type: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  separator: css({
    color: theme.colors.text.disabled,
  }),
  config: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  cardDescription: css({
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(1),
  }),
});
