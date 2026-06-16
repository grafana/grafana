import { useEffect, useMemo, useState } from 'react';

import { useLazyListRecordingRuleQuery } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type Folder, type ResourceStats, useLazyGetFolderCountsQuery } from 'app/api/clients/folder/v1beta1';

const ALERT_RULE_RESOURCE = 'alertrules';
const PRIMARY_ALERT_RULE_GROUP = 'rules.alerting.grafana.app';
const SQL_FALLBACK_GROUP = 'sql-fallback';

function getFolderUid(folder: Folder): string {
  return folder.metadata?.name ?? '';
}

function getFolderTitle(folder: Folder): string {
  return folder.spec?.title ?? getFolderUid(folder);
}

export function useK8sFolderCountsFilter(folders: Folder[], namespaceFilter?: string) {
  const [triggerGetFolderCounts] = useLazyGetFolderCountsQuery();
  const [triggerListRecordingRules] = useLazyListRecordingRuleQuery();

  const [countsByFolderUid, setCountsByFolderUid] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    const folderUidsToFetch = folders
      .map(getFolderUid)
      .filter((uid) => Boolean(uid) && countsByFolderUid[uid] === undefined);

    if (folderUidsToFetch.length === 0) {
      return;
    }

    let cancelled = false;
    setIsLoadingCounts(true);
    setError(undefined);

    Promise.all(
      folderUidsToFetch.map(async (uid) => {
        const result = await triggerGetFolderCounts({ name: uid }).unwrap();
        const alertRuleCount = getAlertRuleCount(result.counts ?? []);
        if (alertRuleCount > 0) {
          return { uid, totalRules: alertRuleCount };
        }

        // /counts doesn't expose recordingrules in this environment.
        // For recording-only folders, probe with a lightweight existence query.
        const recordingRules = await triggerListRecordingRules({
          labelSelector: `grafana.app/folder=${uid}`,
          limit: 1,
        }).unwrap();

        const hasRecordingRules = (recordingRules.items ?? []).length > 0;
        return { uid, totalRules: hasRecordingRules ? 1 : 0 };
      })
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        setCountsByFolderUid((current) => {
          const next = { ...current };
          for (const item of results) {
            next[item.uid] = item.totalRules;
          }
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCounts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countsByFolderUid, folders, triggerGetFolderCounts, triggerListRecordingRules]);

  const normalizedNamespaceFilter = namespaceFilter?.trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    return folders.filter((folder) => {
      const uid = getFolderUid(folder);
      const folderTitle = getFolderTitle(folder).toLowerCase();
      const hasAnyRules = (countsByFolderUid[uid] ?? 0) > 0;

      if (!hasAnyRules) {
        return false;
      }

      if (!normalizedNamespaceFilter) {
        return true;
      }

      return folderTitle.includes(normalizedNamespaceFilter);
    });
  }, [countsByFolderUid, folders, normalizedNamespaceFilter]);

  return {
    filteredFolders,
    isLoadingCounts,
    error,
  };
}

function getAlertRuleCount(counts: ResourceStats[]): number {
  const primary = counts.find(
    (entry) => entry.group === PRIMARY_ALERT_RULE_GROUP && entry.resource === ALERT_RULE_RESOURCE
  )?.count;
  if (typeof primary === 'number' && primary > 0) {
    return primary;
  }

  const fallback = counts.find(
    (entry) => entry.group === SQL_FALLBACK_GROUP && entry.resource === ALERT_RULE_RESOURCE
  )?.count;
  if (typeof fallback === 'number') {
    return fallback;
  }

  // Last resort: use any alertrules entry if group names differ in future.
  return counts.find((entry) => entry.resource === ALERT_RULE_RESOURCE)?.count ?? 0;
}
