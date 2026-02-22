import memoizeOne from 'memoize-one';
import Skeleton from 'react-loading-skeleton';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { Alert, Column, InteractiveTable, Text, TextLink } from '@grafana/ui';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { useGetFolderQueryFacade } from 'app/api/clients/folder/v1beta1/hooks';
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
          /{original.title}
        </TextLink>
      ),
    },
    {
      id: 'folder',
      header: t('teams.team-pages.team-folders.table.parent-folder', 'Parent folder'),
      cell: ({ row: { original } }) => <ParentFolderCell parentUid={original.folder} />,
    },
  ];
});

const getSkeletonData = memoizeOne(() =>
  new Array(3).fill(null).map((_, index) => ({
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
    { ownerReference: [`iam.grafana.app/Team/${teamUid}`], type: 'folder' },
    { skip: !teamUid }
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
    return <Text color="secondary">{t('teams.team-pages.team-folders.empty', 'No folders owned by this team')}</Text>;
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

function ParentFolderCell({ parentUid }: { parentUid?: string }) {
  // Not having a parent folder on a resource is the same as being in root or general folder but in case somebody just
  // passes general folder UID explicitly let's normalize that a bit
  if (parentUid === GENERAL_FOLDER_UID) {
    parentUid = undefined;
  }

  // If parentUid is undefined, this just skips
  const { data: parentFolder, isLoading, isError } = useGetFolderQueryFacade(parentUid);

  if (isLoading) {
    return <Skeleton width={100} />;
  }

  if (isError) {
    // No better error handling here. This is not blocking anything if not shown.
    return <>-</>;
  }

  return (
    <TextLink
      color="primary"
      inline={false}
      href={`/dashboards/f/${parentUid ?? GENERAL_FOLDER_UID}`}
      title={t('teams.team-pages.team-folders.open-parent-folder', 'Open parent folder')}
    >
      /{parentFolder?.title ?? GENERAL_FOLDER_TITLE}
    </TextLink>
  );
}
