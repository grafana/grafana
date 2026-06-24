import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2, dateTimeFormatTimeAgo } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Card, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RepoIcon } from '../Shared/RepoIcon';
import { StatusBadge } from '../Shared/StatusBadge';
import { ManagedBadge } from '../components/ManagedBadge';
import { ReadOnlyBadge } from '../components/ReadOnlyBadge';
import { PROVISIONING_URL } from '../constants';
import { exportResourceAsJson } from '../utils/export';
import { formatRepoUrl, getRepoHrefForProvider } from '../utils/git';
import { getManagerKind, isManagedResourceReadOnly } from '../utils/managedResource';
import { getIsReadOnlyWorkflows } from '../utils/repository';
import { getKindInfoByStatGroup, getRepositoryRoute } from '../utils/resourceKinds';

import { SyncRepository } from './SyncRepository';

interface Props {
  repository: Repository;
}

export function RepositoryListItem({ repository }: Props) {
  const isReadOnlyRepo = getIsReadOnlyWorkflows(repository.spec?.workflows);
  const { metadata, spec, status } = repository;
  const name = metadata?.name ?? '';
  const styles = useStyles2(getStyles);
  // File-provisioned repositories are managed from disk: their config is read-only in the UI.
  const isProvisioned = isManagedResourceReadOnly(repository);
  const managerKind = getManagerKind(repository);

  const getRepositoryMeta = (): ReactNode[] => {
    const meta: ReactNode[] = [];

    if (spec?.type === 'local') {
      meta.push(
        <Text variant="bodySmall" key="path">
          {spec.local?.path ?? ''}
        </Text>
      );
    } else {
      const href = getRepoHrefForProvider(spec);
      if (href) {
        meta.push(
          <TextLink key="link" external href={href}>
            {formatRepoUrl(href)}
          </TextLink>
        );
      }
    }

    if (status?.sync?.finished) {
      meta.push(
        <Text variant="bodySmall" color="secondary" key="last-sync">
          {t('provisioning.repository-card.last-sync', 'Last sync: {{date}}', {
            date: dateTimeFormatTimeAgo(status.sync.finished),
          })}
        </Text>
      );
    }

    return meta;
  };

  return (
    <Card noMargin key={name} className={styles.card}>
      <Card.Figure className={styles.figure}>
        <RepoIcon type={spec?.type} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center" wrap>
          {spec?.title && <Text variant="h3">{spec.title}</Text>}
          <StatusBadge repo={repository} />
          {isReadOnlyRepo && <ReadOnlyBadge repoType={spec?.type} />}
          {isProvisioned && <ManagedBadge managerKind={managerKind} name={spec?.title} />}
        </Stack>
      </Card.Heading>

      <Card.Description>
        <Stack gap={2} direction="column">
          {spec?.description && <Text>{spec.description}</Text>}
          {status?.stats?.length && (
            <Stack gap={1} direction="row" wrap>
              {status.stats.map((stat, index) => {
                const info = getKindInfoByStatGroup(stat.group);
                const icon = info?.icon ?? 'file-alt';
                const label = `${stat.count} ${stat.resource}`;
                // Known kinds link to where the repository's resources live; unknown
                // kinds have no destination, so render a non-interactive badge.
                const href = info ? getRepositoryRoute(info, repository) : undefined;

                return href ? (
                  <LinkButton key={index} fill="outline" size="md" variant="secondary" icon={icon} href={href}>
                    {label}
                  </LinkButton>
                ) : (
                  <Button key={index} fill="outline" size="md" variant="secondary" icon={icon} disabled>
                    {label}
                  </Button>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card.Description>

      <Card.Meta className={styles.meta}>{getRepositoryMeta()}</Card.Meta>

      <Card.Actions>
        <Stack gap={1} direction="row">
          <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="primary" size="md">
            <Trans i18nKey="provisioning.repository-card.view">View</Trans>
          </LinkButton>
          <SyncRepository repository={repository} />
          <Button
            variant="secondary"
            icon="download-alt"
            size="md"
            onClick={() => exportResourceAsJson(repository, 'Repository')}
          >
            <Trans i18nKey="provisioning.repository-card.export">Export</Trans>
          </Button>
          <LinkButton
            variant="secondary"
            icon="cog"
            href={`${PROVISIONING_URL}/${name}/edit`}
            size="md"
            disabled={isProvisioned}
            tooltip={
              isProvisioned
                ? t(
                    'provisioning.repository-card.settings-provisioned-tooltip',
                    'This repository is provisioned from a file and is read-only'
                  )
                : undefined
            }
            onClick={() => {
              reportInteraction('grafana_provisioning_repository_settings_opened', {
                repositoryName: name,
                repositoryType: spec?.type ?? 'unknown',
              });
            }}
          >
            <Trans i18nKey="provisioning.repository-card.settings">Settings</Trans>
          </LinkButton>
        </Stack>
      </Card.Actions>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    [theme.breakpoints.down('md')]: {
      '&&': {
        gridTemplate: `
          "Figure"
          "Heading"
          "Meta"
          "Description" 1fr
          "Actions" / 1fr
        `,
      },
    },
  }),
  figure: css({
    [theme.breakpoints.down('md')]: {
      '&&': {
        marginRight: 0,
        marginBottom: theme.spacing(1),
      },
    },
  }),
  meta: css({
    flexWrap: 'wrap',
  }),
});
