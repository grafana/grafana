import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { SkeletonComponent, attachSkeleton } from '@grafana/ui/src/unstable';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { Snapshot } from 'app/features/dashboard/services/SnapshotSrv';
import { AccessControlAction } from 'app/types';

export interface Props {
  snapshot: Snapshot;
  onRemove: () => void;
}

const SnapshotListTableRowComponent = ({ snapshot, onRemove }: Props) => {
  const url = snapshot.externalUrl || snapshot.url;
  const hasDeletePermission = contextSrv.hasPermission(AccessControlAction.SnapshotsDelete);
  const deleteTooltip = hasDeletePermission
    ? ''
    : t('snapshot.share.delete-permission-tooltip', "You don't have permission to delete snapshots");
  return (
    <tr>
      <td>
        <a href={url}>{snapshot.name}</a>
      </td>
      <td>
        <a href={url}>{url}</a>
      </td>
      <td>
        {snapshot.external && (
          <span className="query-keyword">
            <Trans i18nKey="snapshot.external-badge">External</Trans>
          </span>
        )}
      </td>
      <td className="text-center">
        <LinkButton href={url} variant="secondary" size="sm" icon="eye">
          <Trans i18nKey="snapshot.view-button">View</Trans>
        </LinkButton>
      </td>
      <td className="text-right">
        <Button
          variant="destructive"
          size="sm"
          icon="times"
          onClick={onRemove}
          disabled={!hasDeletePermission}
          tooltip={deleteTooltip}
        />
      </td>
    </tr>
  );
};

const SnapshotListTableRowSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return (
    <tr {...rootProps}>
      <td>
        <Skeleton width={80} />
      </td>
      <td>
        <Skeleton width={240} />
      </td>
      <td></td>
      <td>
        <Skeleton width={63} height={24} containerClassName={styles.blockSkeleton} />
      </td>
      <td>
        <Skeleton width={22} height={24} containerClassName={styles.blockSkeleton} />
      </td>
    </tr>
  );
};

export const SnapshotListTableRow = attachSkeleton(SnapshotListTableRowComponent, SnapshotListTableRowSkeleton);

const getSkeletonStyles = () => ({
  blockSkeleton: css({
    // needed to align correctly in the table
    display: 'block',
    lineHeight: 1,
  }),
});
