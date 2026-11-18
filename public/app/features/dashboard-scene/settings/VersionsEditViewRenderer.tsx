import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Alert, Spinner, Stack } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';

import { type VersionsEditView } from './VersionsEditView';
import { useDashboardEditPageNav } from './utils';
import { VersionsHistoryButtons } from './version-history/VersionHistoryButtons';
import { VersionHistoryComparison } from './version-history/VersionHistoryComparison';
import { VersionHistoryHeader } from './version-history/VersionHistoryHeader';
import { VersionHistoryTable } from './version-history/VersionHistoryTable';

export function VersionsEditViewRenderer({ model }: SceneComponentProps<VersionsEditView>) {
  const dashboard = model.getDashboard();
  const { isLoading, isAppending, viewMode, baseInfo, newInfo, isNewLatest } = model.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

  const userKeys = useMemo(
    () => [...new Set(model.versions.map((v) => v.createdBy).filter(Boolean))],
    [model.versions]
  );
  const { data: displayData } = useGetDisplayMappingQuery(userKeys.length > 0 ? { key: userKeys } : skipToken);
  const isLoadingUserDisplayNames = userKeys.length > 0 && !displayData;

  const versionsWithDisplayNames = useMemo(() => {
    if (!displayData) {
      return model.versions;
    }
    const displayMap = new Map<string, string>();
    for (const item of displayData.display || []) {
      displayMap.set(`${item.identity.type}:${item.identity.name}`, item.displayName);
      if (item.internalId) {
        displayMap.set(String(item.internalId), item.displayName);
      }
    }
    return model.versions.map((version) => {
      const displayName = version.createdBy ? displayMap.get(version.createdBy) : undefined;
      return displayName ? { ...version, createdBy: displayName } : version;
    });
  }, [model.versions, displayData]);

  const canCompare = model.versions.filter((version) => version.checked).length === 2;
  const showButtons = model.versions.length > 1;
  const hasMore = model.versions.length >= model.limit;
  // older versions may have been cleaned up in the db, so also check if the last page is less than the limit, if so, we are at the end
  let isLastPage =
    model.versions.find((rev) => rev.version === 1) ||
    model.versions.length % model.limit !== 0 ||
    model.continueToken === '';

  const viewModeCompare = (
    <>
      <VersionHistoryHeader
        onClick={model.reset}
        baseVersion={baseInfo?.version}
        newVersion={newInfo?.version}
        isNewLatest={isNewLatest}
      />
      {isLoading ? (
        <VersionsHistorySpinner msg="Fetching changes&hellip;" />
      ) : (
        <VersionHistoryComparison
          newInfo={newInfo!}
          baseInfo={baseInfo!}
          isNewLatest={isNewLatest!}
          diffData={model.diffData}
          onRestore={dashboard.onRestore}
        />
      )}
    </>
  );

  const viewModeList = (
    <>
      {isLoading ? (
        <VersionsHistorySpinner msg="Fetching history list&hellip;" />
      ) : (
        <VersionHistoryTable
          versions={versionsWithDisplayNames}
          onCheck={model.onCheck}
          canCompare={canCompare}
          onRestore={dashboard.onRestore}
          isLoadingUserDisplayNames={isLoadingUserDisplayNames}
        />
      )}
      {isAppending && <VersionsHistorySpinner msg="Fetching more entries&hellip;" />}
      {showButtons && (
        <VersionsHistoryButtons
          hasMore={hasMore}
          canCompare={canCompare}
          getVersions={model.fetchVersions}
          getDiff={model.getDiff}
          isLastPage={!!isLastPage}
        />
      )}
    </>
  );

  const isProvisioned = dashboard.isManagedRepository();

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {isProvisioned ? (
        <Alert title="" severity="info">
          <Trans i18nKey="dashboard-settings.versions.provisioned-warning">
            This dashboard is managed by a repository. Version history is not available for provisioned dashboards.
          </Trans>
        </Alert>
      ) : viewMode === 'compare' ? (
        viewModeCompare
      ) : (
        viewModeList
      )}
    </Page>
  );
}

const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <Stack>
    <Spinner />
    <em>{msg}</em>
  </Stack>
);
