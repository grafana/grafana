import { ReactNode } from 'react';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Badge, Card, LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { Repository, ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

import { RepoIcon } from '../Shared/RepoIcon';
import { StatusBadge } from '../Shared/StatusBadge';
import { PROVISIONING_URL } from '../constants';
import { formatRepoUrl, getRepoHrefForProvider } from '../utils/git';
import { getIsReadOnlyWorkflows } from '../utils/repository';

import { SyncRepository } from './SyncRepository';

interface Props {
  repository: Repository;
}

export function RepositoryListItem({ repository }: Props) {
  const isReadOnlyRepo = getIsReadOnlyWorkflows(repository.spec?.workflows);
  const { metadata, spec, status } = repository;
  const name = metadata?.name ?? '';

  const getRepositoryMeta = (): ReactNode[] => {
    const meta: ReactNode[] = [];

    if (spec?.type === 'github') {
      const { url = '', branch } = spec.github ?? {};
      const branchUrl = branch ? `${url}/tree/${branch}` : url;
      const href = getRepoHrefForProvider(spec) || branchUrl;

      meta.push(
        <TextLink key="link" external href={href}>
          {formatRepoUrl(href)}
        </TextLink>
      );
    } else if (spec?.type === 'local') {
      meta.push(
        <Text variant="bodySmall" key="path">
          {spec.local?.path ?? ''}
        </Text>
      );
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
    <Card noMargin key={name}>
      <Card.Figure>
        <RepoIcon type={spec?.type} />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          {spec?.title && <Text variant="h3">{spec.title}</Text>}
          <StatusBadge repo={repository} />
          {isReadOnlyRepo && (
            <Badge color="darkgrey" text={t('provisioning.repository-card.read-only-badge', 'Read only')} />
          )}
        </Stack>
      </Card.Heading>

      <Card.Description>
        <Stack gap={2} direction="column">
          {spec?.description && <Text>{spec.description}</Text>}
          {status?.stats?.length && (
            <Stack gap={1} direction="row" wrap>
              {status.stats.map((stat, index) => (
                <LinkButton
                  key={index}
                  fill="outline"
                  size="md"
                  variant="secondary"
                  href={getListURL(repository, stat)}
                >
                  {stat.count} {stat.resource}
                </LinkButton>
              ))}
            </Stack>
          )}
        </Stack>
      </Card.Description>

      <Card.Meta>{getRepositoryMeta()}</Card.Meta>

      <Card.Actions>
        <Stack gap={1} direction="row">
          <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="primary" size="md">
            <Trans i18nKey="provisioning.repository-card.view">View</Trans>
          </LinkButton>
          <SyncRepository repository={repository} />
          <LinkButton
            variant="secondary"
            icon="cog"
            href={`${PROVISIONING_URL}/${name}/edit`}
            size="md"
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

// Helper function
function getListURL(repo: Repository, stats: ResourceCount): string {
  if (stats.resource === 'playlists') {
    return '/playlists';
  }
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}
