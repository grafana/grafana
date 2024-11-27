import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';
import { config } from 'yargs';

import { getBackendSrv } from '@grafana/runtime';
import { EmptyState, Spinner, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetRepositoryQuery } from './api';
import { PROVISIONING_URL } from './constants';

export default function RepositoryStatusPage() {
  const { name = '' } = useParams();
  const query = useGetRepositoryQuery({ name });

  const vals = useAsync(() => {
    return getBackendSrv().get(`apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/${name}/files/`);
  }, [name])

  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
  return (
    <Page
      navId="provisioning"
      pageNav={{ 
        text: query.data?.spec.title ?? 'Repository Status', 
        subTitle: 'Configure a repository for storing your resources.' 
      }}
    >
      <Page.Contents isLoading={query.isLoading}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (<div>
          { vals.loading && <Spinner />}
          {vals.value && <>
            <pre>{JSON.stringify(vals.value, null, '  ')}</pre>
          </>}
        </div>
        )}
      </Page.Contents>
    </Page>
  );
}
