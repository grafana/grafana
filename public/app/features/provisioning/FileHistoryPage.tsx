import { useParams } from 'react-router-dom-v5-compat';

import { Card, EmptyState, Spinner, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetRepositoryHistoryWithPathQuery, useGetRepositoryStatusQuery } from './api';
import { HistoryListResponse } from './api/types';
import { PROVISIONING_URL } from './constants';

export default function FileHistoryPage() {
  const params = useParams();
  const name = params['name'] ?? '';
  const path = params['*'] ?? '';
  const query = useGetRepositoryStatusQuery({ name });
  const history = useGetRepositoryHistoryWithPathQuery({ name, path });

  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
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
    <div>
      <div>
        <h5>History</h5>
        {history.items.map((item) => (
          <Card href={`${PROVISIONING_URL}/${repo}/file/${path}?ref=${item.ref}`}>
            <Card.Heading>{item.message}</Card.Heading>
            <Card.Meta>
              <>Authors</>
              {item.authors.map((a) => (
                <span>
                  <a href={`https://github.com/${a.username}`}>{a.name}</a>
                </span>
              ))}
            </Card.Meta>
          </Card>
        ))}
      </div>
    </div>
  );
}
