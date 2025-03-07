import { ReactNode } from 'react';

import { IconName, Stack, Text, TextLink, Icon, Card, LinkButton } from '@grafana/ui';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository, ResourceCount } from './api';
import { PROVISIONING_URL } from './constants';

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
        <TextLink key="link" external style={{ color: 'inherit' }} href={branchUrl}>
          {branchUrl}
        </TextLink>
      );

      if (status?.webhook?.id) {
        const webhookUrl = `${url}/settings/hooks/${status.webhook.id}`;
        meta.push(
          <TextLink key="webhook" style={{ color: 'inherit' }} href={webhookUrl}>
            Webhook <Icon name="check" />
          </TextLink>
        );
      }
    } else if (spec?.type === 'local') {
      meta.push(
        <Text element="p" key="path">
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
        <Icon name={getRepositoryIcon()} width={40} height={40} />
      </Card.Figure>
      <Card.Heading>
        <Stack>
          {spec?.title}
          <StatusBadge enabled={Boolean(spec?.sync?.enabled)} state={status?.sync?.state} name={name} />
        </Stack>
      </Card.Heading>

      <Card.Description>
        {spec?.description}
        {status?.stats?.length && (
          <Stack>
            {status.stats.map((stat, index) => (
              <LinkButton key={index} fill="outline" size="md" href={getListURL(repository, stat)}>
                {stat.count} {stat.resource}
              </LinkButton>
            ))}
          </Stack>
        )}
      </Card.Description>

      <Card.Meta>{getRepositoryMeta()}</Card.Meta>

      <Card.Actions>
        <LinkButton icon="eye" href={`${PROVISIONING_URL}/${name}`} variant="secondary">
          View
        </LinkButton>
        <SyncRepository repository={repository} />
        <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
          Settings
        </LinkButton>
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
