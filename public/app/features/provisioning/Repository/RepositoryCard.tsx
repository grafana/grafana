import { ReactNode } from 'react';

import { IconName, Stack, Text, TextLink, Icon, Card, LinkButton } from '@grafana/ui';
import { Repository, ResourceCount } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { StatusBadge } from '../Shared/StatusBadge';
import { PROVISIONING_URL } from '../constants';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SyncRepository } from './SyncRepository';

interface Props {
  repository: Repository;
}

export function RepositoryCard({ repository }: Props) {
  const { metadata, spec, status } = repository;
  const name = metadata?.name ?? '';

  const getRepositoryMeta = (): ReactNode[] => {
    const meta: ReactNode[] = [];

    if (spec?.type === 'github') {
      const { url = '', branch } = spec.github ?? {};
      const branchUrl = branch ? `${url}/tree/${branch}` : url;

      meta.push(
        <TextLink key="link" external href={branchUrl}>
          {branchUrl}
        </TextLink>
      );

      if (status?.webhook?.id) {
        const webhookUrl = `${url}/settings/hooks/${status.webhook.id}`;
        meta.push(
          <Stack gap={1} direction="row" alignItems="center">
            <TextLink key="webhook" href={webhookUrl}>
              <Trans i18nKey="provisioning.repository-card.get-repository-meta.webhook">Webhook</Trans>
            </TextLink>
            <Icon name="check" className="text-success" />
          </Stack>
        );
      }
    } else if (spec?.type === 'local') {
      meta.push(
        <Text variant="bodySmall" key="path">
          {spec.local?.path ?? ''}
        </Text>
      );
    }

    return meta;
  };

  const getRepositoryIcon = (): IconName => {
    return spec?.type === 'github' ? 'github' : 'database';
  };

  return (
    <Card key={name}>
      <Card.Figure>
        <Icon name={getRepositoryIcon()} size="xxl" />
      </Card.Figure>
      <Card.Heading>
        <Stack gap={2} direction="row" alignItems="center">
          {spec?.title && <Text variant="h3">{spec.title}</Text>}
          <StatusBadge repo={repository} />
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

      <Card.Meta>
        <Stack gap={2} direction="row" wrap>
          {getRepositoryMeta()}
        </Stack>
      </Card.Meta>

      <Card.Actions>
        <Stack gap={1} direction="row">
          <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="primary" size="md">
            <Trans i18nKey="provisioning.repository-card.view">View</Trans>
          </LinkButton>
          <SyncRepository repository={repository} />
          <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`} size="md">
            <Trans i18nKey="provisioning.repository-card.settings">Settings</Trans>
          </LinkButton>
        </Stack>
      </Card.Actions>
      <Card.SecondaryActions>
        <DeleteRepositoryButton name={name} />
      </Card.SecondaryActions>
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
