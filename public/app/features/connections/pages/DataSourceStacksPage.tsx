import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Card,
  EmptyState,
  FilterInput,
  IconButton,
  LinkButton,
  Spinner,
  Stack,
  TagList,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { Resource, ResourceList, GroupVersionResource } from 'app/features/apiserver/types';

// Define the DataSourceStack spec type based on the backend Go types
export interface DataSourceStackTemplateItem {
  group: string;
  name: string;
}

export interface DataSourceStackModeItem {
  dataSourceRef: string;
}

export interface DataSourceStackModeSpec {
  name: string;
  uid: string;
  definition: Record<string, DataSourceStackModeItem>;
}

export interface DataSourceStackSpec {
  template: Record<string, DataSourceStackTemplateItem>;
  modes: DataSourceStackModeSpec[];
}

// GroupVersionResource for datasourcestacks
const datasourceStacksGVR: GroupVersionResource = {
  group: 'collections.grafana.app',
  version: 'v1alpha1',
  resource: 'datasourcestacks',
};

const datasourceStacksClient = new ScopedResourceClient<DataSourceStackSpec>(datasourceStacksGVR);

export function DataSourceStacksPage() {
  const [stacks, setStacks] = useState<Array<Resource<DataSourceStackSpec>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const styles = useStyles2(getStyles);

  const fetchStacks = useCallback(async () => {
    try {
      setLoading(true);
      const response: ResourceList<DataSourceStackSpec> = await datasourceStacksClient.list();
      setStacks(response.items);
    } catch (err) {
      console.error('Failed to fetch datasource stacks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch datasource stacks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStacks();
  }, [fetchStacks]);

  const onDeleteStack = (stackName: string) => async () => {
    await datasourceStacksClient.delete(stackName, false);
    fetchStacks();
  };

  // Filter stacks based on search query
  const filteredStacks = useMemo(() => {
    if (!searchQuery) {
      return stacks;
    }
    const query = searchQuery.toLowerCase();
    return stacks.filter((stack) => {
      const nameMatch = stack.metadata.name?.toLowerCase().includes(query);
      const templateMatch = Object.values(stack.spec.template).some(
        (template) => template.name.toLowerCase().includes(query) || template.group.toLowerCase().includes(query)
      );
      return nameMatch || templateMatch;
    });
  }, [stacks, searchQuery]);

  const actions =
    stacks.length > 0 ? (
      <LinkButton variant="primary" icon="plus" href="/connections/stacks/new">
        <Trans i18nKey="connections.stacks-list-view.add-stack">Add stack</Trans>
      </LinkButton>
    ) : undefined;

  const pageNav = {
    text: t('connections.stacks-list-view.title', 'Data source stacks'),
    subTitle: t(
      'connections.stacks-list-view.subtitle',
      'Manage your data source stacks to group environments like dev, staging, and production'
    ),
  };

  return (
    <Page navId="connections-stacks" pageNav={pageNav} actions={actions}>
      <Page.Contents>
        <DataSourceStacksListContent
          stacks={filteredStacks}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onDeleteStack={onDeleteStack}
          styles={styles}
        />
      </Page.Contents>
    </Page>
  );
}

interface DataSourceStacksListContentProps {
  stacks: Array<Resource<DataSourceStackSpec>>;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  styles: ReturnType<typeof getStyles>;
  onDeleteStack: (stackName: string) => () => Promise<void>;
}

function DataSourceStacksListContent({
  stacks,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  styles,
  onDeleteStack,
}: DataSourceStacksListContentProps) {
  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <EmptyState
        variant="not-found"
        message={t('connections.stacks-list-view.error', 'Failed to load data source stacks')}
      >
        <div>{error}</div>
      </EmptyState>
    );
  }
  if (stacks.length === 0 && !searchQuery) {
    return (
      <EmptyState
        message={t(
          'connections.stacks-list-view.empty.no-rules-created',
          "You haven't created any data source stacks yet"
        )}
        variant="call-to-action"
      >
        <div>
          <Trans i18nKey="connections.stacks-list-view.empty.description">
            Use data source stacks to group environments like dev, stg, and prod. Reference the stack in your query, and
            Grafana automatically selects the right data source for that environment.
          </Trans>
        </div>

        <LinkButton variant="primary" icon="plus" size="lg" href="/connections/stacks/new">
          <Trans i18nKey="connections.stacks-list-view.empty.new-stack">New stack</Trans>
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.searchContainer}>
        <FilterInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('connections.stacks-list-view.search-placeholder', 'Search by name or type')}
        />
      </div>
      {stacks.length === 0 && searchQuery ? (
        <EmptyState
          variant="not-found"
          message={t('connections.stacks-list-view.no-results', 'No data source stacks found')}
        />
      ) : (
        <ul className={styles.list}>
          {stacks.map((stack) => (
            <li key={stack.metadata.name}>
              <Card noMargin href={`/connections/stacks/edit/${stack.metadata.name}`}>
                <Card.Heading>{stack.metadata.name}</Card.Heading>
                <Card.Tags>
                  <Stack direction="row" gap={2} alignItems="center">
                    <TagList tags={getDatasourceList(stack.spec)} />
                    <IconButton
                      name="trash-alt"
                      variant="destructive"
                      aria-label={t('connections.stacks-list-view.delete-stack', 'Delete stack')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteStack(stack.metadata.name)();
                      }}
                    />
                  </Stack>
                </Card.Tags>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  searchContainer: css({
    marginBottom: theme.spacing(2),
    maxWidth: '500px',
  }),
  list: css({
    listStyle: 'none',
    display: 'grid',
    gap: theme.spacing(1),
  }),
});

const getDatasourceList = (stack: DataSourceStackSpec): string[] => {
  return Array.from(
    // remove duplicates
    new Set(
      Object.values(stack.template).map((template) => {
        const match = template.group.match(/^grafana-(.+)-datasource$/);
        if (match && match[1]) {
          return match[1].charAt(0).toUpperCase() + match[1].slice(1);
        }
        return template.name.charAt(0).toUpperCase() + template.name.slice(1);
      })
    )
  );
};
