import { useEffect, useState } from 'react';

import { isFetchError } from '@grafana/runtime';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { useDispatch } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { refetchChildren } from '../state/actions';
import { itemCascadeDeleteFinished } from '../state/slice';

import { CascadeDeleteIndicator } from './CascadeDeleteIndicator';

// Dashboards have no RTK Query endpoint exposing a single item's raw metadata with built-in
// polling support (unlike folders' useGetFolderQuery), so this PoC polls the same promise-based
// DashboardAPI the delete flow itself already uses (getDashboardDTO's `meta.k8s`).
const POLL_INTERVAL_MS = 3000;

interface Props {
  /** UID of the dashboard undergoing cascade delete. */
  dashboardUID: string;
  /** UID of the dashboard's parent folder, so its row can be refetched once cascade delete completes. */
  parentUID?: string;
}

/**
 * Dashboard counterpart of DeletingFolderBadge. Dashboards have no `status.cascadeDelete` field
 * (only folders do), so this only tracks `metadata.deletionTimestamp` with no remaining-count
 * detail -- see CascadeDeleteIndicator for the shared visual.
 *
 * Only rendered for dashboards tracked in `cascadeDeletingUIDs` (see state/slice.ts), so ordinary
 * dashboard rows never pay for an extra request.
 */
export function DeletingDashboardBadge({ dashboardUID, parentUID }: Props) {
  const dispatch = useDispatch();
  const [isStillDeleting, setIsStillDeleting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        // Use the v1 API explicitly: the unified DashboardAPI's getDashboardDTO return type is a
        // v1/v2 union without a common `.meta`, but the v1 `dto` subresource reads through
        // regardless of the dashboard's actual stored version.
        const api = await getDashboardAPI('v1');
        const dto = await api.getDashboardDTO(dashboardUID);
        if (!cancelled && !dto.meta.k8s?.deletionTimestamp) {
          setIsStillDeleting(false);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        // A 404 means cascade delete finished and the dashboard is actually gone; treat any other
        // error (e.g. transient network failure) the same way rather than polling forever on a
        // dashboard we can't read -- acceptable for this PoC's simple polling fallback.
        setIsStillDeleting(false);
        if (!(isFetchError(error) && error.status === 404)) {
          console.error('Error checking cascade delete status for dashboard', dashboardUID, error);
        }
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dashboardUID]);

  useEffect(() => {
    if (!isStillDeleting) {
      dispatch(itemCascadeDeleteFinished(dashboardUID));
      dispatch(refetchChildren({ parentUID, pageSize: PAGE_SIZE }));
    }
  }, [isStillDeleting, dispatch, dashboardUID, parentUID]);

  if (!isStillDeleting) {
    return null;
  }

  return <CascadeDeleteIndicator />;
}
