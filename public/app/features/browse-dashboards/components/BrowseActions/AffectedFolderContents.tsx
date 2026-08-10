import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';
import { useGetAffectedItems } from 'app/api/clients/folder/v1beta1/hooks';

import { type DashboardTreeSelection } from '../../types';

import { getFolderIsEmpty, getSelectedFolderUIDs } from './utils';

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
  const styles = useStyles2(getStyles);
  const selectedFolders = getSelectedFolderUIDs(selectedItems);
  const { data, isLoading, isFetching, error } = useGetAffectedItems(selectedItems);

  let contents: ReactNode = undefined;

  if (selectedFolders.length > 0) {
    if (isLoading || isFetching) {
      contents = <Skeleton width={200} />;
    } else if (error) {
      contents = (
        <Alert
          className={styles.alert}
          severity="warning"
          title={t(
            'browse-dashboards.affected-folder-contents-error',
            "We couldn't get information about folder contents."
          )}
        />
      );
    } else if (data) {
      const folderIsEmpty = getFolderIsEmpty(data, selectedItems);
      contents = (
        <>
          {folderIsEmpty && emptyMessage && <Alert className={styles.alert} severity="success" title={emptyMessage} />}
          {!folderIsEmpty && nonEmptyMessage && (
            <Alert className={styles.alert} severity="warning" title={nonEmptyMessage} />
          )}
        </>
      );
    }
  }

  return (
    <>
      {defaultMessage}
      {contents}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The alert title is a span that inherits font size, which in modals resolves to a size larger than the
  // surrounding body text, so size it down to match.
  alert: css({
    fontSize: theme.typography.body.fontSize,
  }),
});
