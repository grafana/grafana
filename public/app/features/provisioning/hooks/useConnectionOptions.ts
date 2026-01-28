import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { useLazyGetConnectionRepositoriesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { formatRepoUrl } from '../utils/git';

import { useConnectionList } from './useConnectionList';

interface ExternalRepository {
  name?: string;
  owner?: string;
  url?: string;
}

export function useConnectionOptions(enabled: boolean) {
  const [connections, connectionsLoading] = useConnectionList(enabled ? {} : skipToken);
  const githubConnections = useMemo(() => connections?.filter((c) => c.spec?.type === 'github') ?? [], [connections]);

  const connectionNames = useMemo(() => {
    const names: string[] = [];
    for (const conn of githubConnections) {
      const name = conn.metadata?.name;
      if (name) {
        names.push(name);
      }
    }
    return names;
  }, [githubConnections]);

  const [fetchRepos] = useLazyGetConnectionRepositoriesQuery();

  const { value: reposByConnection, loading: reposLoading } = useAsync(async () => {
    const result: Record<string, string[]> = {};

    for (const name of connectionNames) {
      try {
        const response = await fetchRepos({ name }).unwrap();
        const items: ExternalRepository[] = response.items ?? [];
        result[name] = items
          .map((item) => {
            // Use same URL formatting as RepositoryListItem
            const formattedUrl = formatRepoUrl(item.url);
            if (formattedUrl) {
              return formattedUrl;
            }
            // Fallback to owner/name if URL not available
            if (item.owner && item.name) {
              return `${item.owner}/${item.name}`;
            }
            return item.name ?? '';
          })
          .filter(Boolean);
      } catch {
        result[name] = [];
      }
    }

    return result;
  }, [connectionNames.join(',')]);

  const options = useMemo(() => {
    return githubConnections.map((conn) => {
      const name = conn.metadata?.name ?? '';
      const title = conn.spec?.title || name;
      const connDescription = conn.spec?.description;
      const repos = reposByConnection?.[name];
      const descriptionParts: string[] = [];

      if (connDescription) {
        descriptionParts.push(connDescription);
      }

      if (reposLoading || !reposByConnection) {
        descriptionParts.push(t('provisioning.connection-options.loading', 'Loading...'));
      } else if (!repos || repos.length === 0) {
        descriptionParts.push(t('provisioning.connection-options.no-repos', 'No repositories'));
      } else {
        const maxToShow = 2;
        const shown = repos.slice(0, maxToShow).join(', ');
        const remaining = repos.length - maxToShow;
        const repoText =
          remaining > 0
            ? t('provisioning.connection-options.repos-truncated', '{{shown}} +{{count}} more', {
                shown,
                count: remaining,
              })
            : shown;
        descriptionParts.push(repoText);
      }

      return { value: name, label: title, description: descriptionParts.join(' · ') };
    });
  }, [githubConnections, reposByConnection, reposLoading]);

  return { options, isLoading: connectionsLoading || reposLoading };
}
