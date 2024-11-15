import { EmptyState, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useListRepositoryQuery } from './api';

export default function RepositoryListPage() {
  const query = useListRepositoryQuery();
  return (
    <Page navId="provisioning" subTitle="View and manage your configured repositories">
      <Page.Contents isLoading={query.isLoading}>
        {!query.data?.items?.length && (
          <EmptyState
            variant="call-to-action"
            message="You haven't created any repository configs yet"
            button={
              <LinkButton icon="plus" href="/admin/provisioning/new" size="lg">
                Create repository config
              </LinkButton>
            }
          ></EmptyState>
        )}
      </Page.Contents>
    </Page>
  );
}
