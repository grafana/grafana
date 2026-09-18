import { useEffect, useState } from 'react';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import { type ObjectMeta } from 'app/features/apiserver/types';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { useDispatch, useSelector } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { refetchChildren } from '../state/actions';
import { itemCascadeDeleteFinished } from '../state/slice';

import { CascadeDeleteIndicator } from './CascadeDeleteIndicator';

// Dashboards have no RTK Query endpoint exposing a single item's raw metadata with built-in
// polling support (unlike folders' useGetFolderQuery), so this polls the raw k8s resource
// directly instead -- showErrorAlert: false is essential here: a 404 is the *expected* outcome
// once the dashboard is actually gone, not a real error worth popping a toast over.
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
  // Dashboards have no status of their own to report a stuck delete -- the error lives on
  // whichever ancestor folder's reconcile pass actually tried and failed to delete this one (see
  // usePropagateCascadeDeleteToChildren).
  const errors = useSelector((state) => state.browseDashboards.cascadeDeleteErrors[dashboardUID]);

  useEffect(() => {
    let cancelled = false;
    const url = `/apis/${DASHBOARD_API_GROUP}/${dashboardAPIVersionResolver.getV1()}/namespaces/${getAPINamespace()}/dashboards/${dashboardUID}`;

    async function poll() {
      try {
        // Deliberately not clearing isStillDeleting here even if no deletionTimestamp is set yet:
        // this dashboard is only tracked because a cascade delete affecting it is underway (see
        // usePropagateCascadeDeleteToChildren), and the backend may not have reached it yet --
        // there's no reliable "definitely not going to be deleted after all" signal to bail out on
        // early, so keep showing "Deleting" until it's actually gone (the catch block's 404).
        await getBackendSrv().get<{ metadata: ObjectMeta }>(url, undefined, undefined, { showErrorAlert: false });
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

  return <CascadeDeleteIndicator errors={errors} />;
}
