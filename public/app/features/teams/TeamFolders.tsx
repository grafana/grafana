import { skipToken } from '@reduxjs/toolkit/query';
import memoizeOne from 'memoize-one';
import { Fragment } from 'react';
import Skeleton from 'react-loading-skeleton';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { Alert, Column, EmptyState, InteractiveTable, TextLink } from '@grafana/ui';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { useGetFolderParentsQuery } from 'app/api/clients/folder/v1beta1';
import { GENERAL_FOLDER_TITLE, GENERAL_FOLDER_UID } from 'app/features/search/constants';

import { extractErrorMessage } from '../../api/utils';

// We need getColumns and getSkeletonData to be functions because they use t() which cannot be called in global context.
const getColumns = memoizeOne((): Array<Column<DashboardHit>> => {
  return [
    {
      id: 'title',
      header: t('teams.team-pages.team-folders.table.name', 'Name'),
      cell: ({ row: { original } }) => (
        <TextLink
          color="primary"
          inline={false}
          href={`/dashboards/f/${original.name}`}
          title={t('teams.team-pages.team-folders.open-folder', 'Open folder')}
        >
          {original.title}
        </TextLink>
      ),
    },
    {
      id: 'folder',
      header: t('teams.team-pages.team-folders.table.path', 'Full path'),
      cell: ({ row: { original } }) => <FolderPathCell folderUid={original.name} />,
    },
  ];
});

const getSkeletonData = memoizeOne(() =>
  Array.from({ length: 3 }, (_, index) => ({
    name: `loading-folder-${index}`,
    resource: 'folder',
    title: t('teams.team-pages.team-folders.loading', 'Loading...'),
  }))
);

/**
 * Shows list of folders owned by the team.
 * @param teamUid
 * @constructor
 */
export function TeamFolders({ teamUid }: { teamUid: string }) {
  const { data, isLoading, error } = useSearchDashboardsAndFoldersQuery(
    teamUid ? { ownerReference: [`iam.grafana.app/Team/${teamUid}`], type: 'folder' } : skipToken
  );

  const folders = data?.hits ?? [];

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('teams.team-pages.team-folders.error-loading-folders', 'Could not load team folders')}
      >
        {extractErrorMessage(error)}
      </Alert>
    );
  }

  if (!isLoading && !folders.length) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t('teams.team-pages.team-folders.empty-state-message', 'This team does not own any folders yet.')}
      >
        {t(
          'teams.team-pages.team-folders.empty-state-content',
          'You can set up ownership of a folder from folder detail page'
        )}
      </EmptyState>
    );
  }

  return (
    <InteractiveTable
      columns={getColumns()}
      data={isLoading ? getSkeletonData() : folders}
      getRowId={(folder) => folder.name}
      pageSize={25}
    />
  );
}

function FolderPathCell({ folderUid }: { folderUid: string }) {
  const isSkeletonData = folderUid.startsWith('loading-folder');
  const { data, isLoading, isError } = useGetFolderParentsQuery(
    folderUid && !isSkeletonData ? { name: folderUid } : skipToken
  );

  if (isLoading || isSkeletonData) {
    return <Skeleton width={220} />;
  }

  if (isError || !data?.items.length) {
    // No better error handling here. This is not blocking anything if not shown.
    return <>-</>;
  }

  // We add the general folder "Dashboards" as root to align with other UI
  const pathParts = [{ name: GENERAL_FOLDER_UID, title: GENERAL_FOLDER_TITLE }, ...data.items];

  return (
    <>
      {pathParts.map((part) => (
        <Fragment key={part.name}>
          /
          <TextLink color="primary" inline={false} href={`/dashboards/f/${part.name}`}>
            {part.title}
          </TextLink>
        </Fragment>
      ))}
    </>
  );
}
