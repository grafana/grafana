import { useParams } from 'react-router-dom-v5-compat';

import { EmptyState, Text, TextLink } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning';
import { Page } from 'app/core/components/Page/Page';

import { ConfigForm } from '../Config/ConfigForm';
import { PROVISIONING_URL } from '../constants';

export default function EditRepositoryPage() {
  const { name = '' } = useParams();
  const query = useGetRepositoryQuery({ name });
  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Configure repository', subTitle: 'Configure a repository for storing your resources.' }}
    >
      <Page.Contents isLoading={query.isLoading}>
        {notFound ? (
          <EmptyState message={`Repository config not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <ConfigForm data={query.data} />
        )}
      </Page.Contents>
    </Page>
  );
}
