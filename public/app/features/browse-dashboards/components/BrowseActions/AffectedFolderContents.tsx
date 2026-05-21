import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Alert } from '@grafana/ui';
import { useGetAffectedItems } from 'app/api/clients/folder/v1beta1/hooks';

import { type DashboardTreeSelection } from '../../types';

import { getFolderIsEmpty } from './utils';

interface Props {
  selectedItems: Pick<DashboardTreeSelection, 'folder' | 'dashboard'>;
  /** Rendered always, regardless of loading state, counts, or whether any folders are selected. */
  defaultMessage?: ReactNode;
  /** Title of the success alert shown when the selected folders contain no descendants. Omit to render nothing. */
  emptyMessage?: string;
  /** Title of the warning alert shown when the selected folders contain other resources. Omit to render nothing. */
  nonEmptyMessage?: string;
}

/**
 * Renders an alert describing whether the selected folders contain other resources. Intended for confirmation
 * surfaces (delete, move, manage permissions, etc.) where the user should know that an action on a folder
 * cascades to its descendants.
 *
 * The conditional alert is only rendered when at least one folder is selected — there are no descendants to
 * warn about otherwise. `defaultMessage` is always rendered.
 */
export function AffectedFolderContents({ selectedItems, defaultMessage, emptyMessage, nonEmptyMessage }: Props) {
  const selectedFolders = Object.keys(selectedItems.folder || {}).filter((uid) => selectedItems.folder[uid]);
  const { data, isLoading } = useGetAffectedItems(selectedItems);
  const folderIsEmpty = getFolderIsEmpty(data, selectedItems);

  return (
    <>
      {defaultMessage}
      {selectedFolders.length > 0 &&
        (isLoading ? (
          <Skeleton width={200} />
        ) : (
          <>
            {folderIsEmpty && emptyMessage && <Alert severity="success" title={emptyMessage} />}
            {!folderIsEmpty && nonEmptyMessage && <Alert severity="warning" title={nonEmptyMessage} />}
          </>
        ))}
    </>
  );
}
