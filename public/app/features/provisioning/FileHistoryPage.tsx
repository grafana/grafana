import { useParams } from 'react-router-dom-v5-compat';

import { Card, EmptyState, Spinner, Stack, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { isNotFoundError } from '../alerting/unified/api/util';

import { useGetRepositoryHistoryWithPathQuery, useGetRepositoryStatusQuery } from './api';
import { HistoryListResponse } from './api/types';
import { PROVISIONING_URL } from './constants';
import { formatTimestamp } from './utils/time';

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
        text: `History: ${path}`, //,
        subTitle: query.data?.spec?.title ?? 'Repository',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
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
    return <div>not found</div>;
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
            <Stack gap={1}>
              <Stack>
                {item.authors.map((a) => (
                  <span key={a.username} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {a.avatarURL && (
                      <img
                        src={a.avatarURL}
                        alt={`${a.name}'s avatar`}
                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    )}
                    <a href={`https://github.com/${a.username}`}>{a.name}</a>
                  </span>
                ))}
              </Stack>
            </Stack>
          </Card.Description>
        </Card>
      ))}
    </Stack>
  );
}
