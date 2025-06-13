import { useParams } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { Card, EmptyState, Spinner, Stack, Text, TextLink, UserIcon } from '@grafana/ui';
import {
  useGetRepositoryHistoryWithPathQuery,
  useGetRepositoryStatusQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import { isNotFoundError } from 'app/features/alerting/unified/api/util';

import { PROVISIONING_URL } from '../constants';
import { HistoryListResponse } from '../types';
import { formatTimestamp } from '../utils/time';

export default function FileHistoryPage() {
  const params = useParams();
  const name = params['name'] ?? '';
  const path = params['*'] ?? '';
  const query = useGetRepositoryStatusQuery({ name });
  const history = useGetRepositoryHistoryWithPathQuery({ name, path });
  const notFound = query.isError && isNotFoundError(query.error);

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: `History: ${path}`,
        subTitle: query.data?.spec?.title ?? 'Repository',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>
              <Trans i18nKey="provisioning.file-history-page.repository-config-exists-configuration">
                Make sure the repository config exists in the configuration file.
              </Trans>
            </Text>
            <TextLink href={PROVISIONING_URL}>
              <Trans i18nKey="provisioning.file-history-page.back-to-repositories">Back to repositories</Trans>
            </TextLink>
          </EmptyState>
        ) : (
          //@ts-expect-error TODO fix history response types
          <div>{history.data ? <HistoryView history={history.data} path={path} repo={name} /> : <Spinner />}</div>
        )}
      </Page.Contents>
    </Page>
  );
}

interface Props {
  history: HistoryListResponse;
  path: string;
  repo: string;
}

function HistoryView({ history, path, repo }: Props) {
  if (!history.items) {
    return <Trans i18nKey="provisioning.history-view.not-found">Not found</Trans>;
  }

  return (
    <Stack direction={'column'}>
      {history.items.map((item) => (
        <Card href={`${PROVISIONING_URL}/${repo}/file/${path}?ref=${item.ref}`} key={item.ref}>
          <Card.Heading>{item.message}</Card.Heading>
          <Card.Meta>
            <span>{formatTimestamp(item.createdAt)}</span>
          </Card.Meta>
          <Card.Description>
            <Stack>
              {item.authors.map((a) => (
                <span key={a.username} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {a.avatarURL && (
                    <UserIcon
                      userView={{
                        user: { name: a.name, avatarUrl: a.avatarURL },
                        lastActiveAt: new Date().toISOString(),
                      }}
                      showTooltip={false}
                    />
                  )}
                  <a href={`https://github.com/${a.username}`}>{a.name}</a>
                </span>
              ))}
            </Stack>
          </Card.Description>
        </Card>
      ))}
    </Stack>
  );
}
