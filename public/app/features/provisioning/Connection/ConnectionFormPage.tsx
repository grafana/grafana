import { skipToken } from '@reduxjs/toolkit/query/react';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Card, EmptyState, Stack, Text, TextLink } from '@grafana/ui';
import {
  useGetConnectionQuery,
  useGetConnectionRepositoriesQuery,
  useListRepositoryQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { CONNECTIONS_URL, PROVISIONING_URL } from '../constants';

import { ConnectionForm } from './ConnectionForm';

// External repository from the provider (e.g., GitHub)
// The API returns `items: any[]` so we define the expected shape here
interface ExternalRepository {
  name?: string;
  url?: string;
}

export default function ConnectionFormPage() {
  const { name = '' } = useParams();
  const isCreate = !name;

  const query = useGetConnectionQuery(isCreate ? skipToken : { name });

  // Grafana repositories that use this connection
  const connectedReposQuery = useListRepositoryQuery(
    isCreate ? skipToken : { fieldSelector: `spec.connection.name=${name}` }
  );
  const connectedRepos = connectedReposQuery.data?.items ?? [];

  // Available external repositories from the provider
  const availableReposQuery = useGetConnectionRepositoriesQuery(isCreate ? skipToken : { name });
  const availableRepos = availableReposQuery.data?.items ?? [];

  //@ts-expect-error TODO add error types
  const notFound = !isCreate && query.isError && query.error?.status === 404;

  const pageTitle = isCreate
    ? t('provisioning.connection-form.page-title-create', 'Create connection')
    : t('provisioning.connection-form.page-title-edit', 'Edit connection');

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: pageTitle,
        subTitle: t(
          'provisioning.connection-form.page-subtitle',
          'Configure a connection to authenticate with external providers'
        ),
      }}
    >
      <Page.Contents isLoading={!isCreate && query.isLoading}>
        {notFound ? (
          <EmptyState message={t('provisioning.connection-form.not-found', 'Connection not found')} variant="not-found">
            <Text element="p">
              <Trans i18nKey="provisioning.connection-form.not-found-description">
                The connection you are looking for does not exist.
              </Trans>
            </Text>
            <TextLink href={CONNECTIONS_URL}>
              <Trans i18nKey="provisioning.connection-form.back-to-connections">Back to connections</Trans>
            </TextLink>
          </EmptyState>
        ) : (
          <Stack direction="column" gap={2}>
            {!isCreate && connectedRepos.length > 0 && (
              <div style={{ maxWidth: 700 }}>
                <Card noMargin>
                  <Card.Heading>
                    <Trans i18nKey="provisioning.connection-form.grafana-repositories">
                      Repositories using this connection
                    </Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Stack direction="column" gap={0.5}>
                      {connectedRepos.map((repo) => (
                        <TextLink key={repo.metadata?.name} href={`${PROVISIONING_URL}/${repo.metadata?.name}`}>
                          {repo.spec?.title || repo.metadata?.name}
                        </TextLink>
                      ))}
                    </Stack>
                  </Card.Description>
                </Card>
              </div>
            )}

            {!isCreate && availableRepos.length > 0 && (
              <div style={{ maxWidth: 700 }}>
                <Card noMargin>
                  <Card.Heading>
                    <Trans i18nKey="provisioning.connection-form.available-repositories">
                      Other available repositories
                    </Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Stack direction="column" gap={0.5}>
                      {availableRepos.map((repo: ExternalRepository, index: number) =>
                        repo.url ? (
                          <TextLink key={repo.name || index} href={repo.url} external>
                            {repo.name || repo.url}
                          </TextLink>
                        ) : (
                          <Text key={repo.name || index}>{repo.name || 'Unknown'}</Text>
                        )
                      )}
                    </Stack>
                  </Card.Description>
                </Card>
              </div>
            )}

            <ConnectionForm data={isCreate ? undefined : query.data} />
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}
