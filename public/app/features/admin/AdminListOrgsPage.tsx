import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { Trans } from '@grafana/i18n';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Organization } from 'app/types/organization';

import { AdminOrgsTable } from './AdminOrgsTable';

const deleteOrg = async (orgId: number) => {
  return await getBackendSrv().delete('/api/orgs/' + orgId);
};

const getOrgs = async () => {
  return await getBackendSrv().get<Organization[]>('/api/orgs');
};

const getErrorMessage = (error: Error) => {
  return isFetchError(error) ? error?.data?.message : 'An unexpected error happened.';
};

export default function AdminListOrgsPages() {
  const [state, fetchOrgs] = useAsyncFn(async () => await getOrgs(), []);
  const canCreateOrg = contextSrv.hasPermission(AccessControlAction.OrgsCreate);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  return (
    <Page
      navId="global-orgs"
      actions={
        <LinkButton icon="plus" href="org/new" disabled={!canCreateOrg}>
          <Trans i18nKey="admin.orgs.new-org-button">New org</Trans>
        </LinkButton>
      }
    >
      <Page.Contents>
        {state.error && getErrorMessage(state.error)}
        {state.loading && <AdminOrgsTable.Skeleton />}
        {state.value && (
          <AdminOrgsTable
            orgs={state.value}
            onDelete={(orgId) => {
              deleteOrg(orgId).then(() => fetchOrgs());
            }}
          />
        )}
      </Page.Contents>
    </Page>
  );
}
