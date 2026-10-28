import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { getIsReadOnlyRepo } from 'app/features/provisioning/utils/repository';
import { getReadOnlyTooltipText } from 'app/features/provisioning/utils/tooltip';

import { FIELD, FOLDER_GROUP_RESOURCE, type ResultItem, groupResourceOf } from '../api/globalSearchApi';

const MANAGER_KINDS = new Set<string>(Object.values(ManagerKind));

function isManagerKind(value: string): value is ManagerKind {
  return MANAGER_KINDS.has(value);
}

export interface ItemManager {
  /** Something outside Grafana owns the item, even a manager this build doesn't know. */
  isManaged: boolean;
  kind?: ManagerKind;
  /** The repository name for Git Sync, the plugin id for plugins, and so on. */
  id?: string;
  repository?: RepositoryView;
  /** Synced from a repository that no longer exists. */
  isOrphaned: boolean;
  /** Why Move is off, or unset when it's allowed. */
  moveLockedReason?: string;
  /** Why Delete is off, or unset when it's allowed. */
  deleteLockedReason?: string;
}

function lockBoth(reason: string | undefined) {
  return { moveLockedReason: reason, deleteLockedReason: reason };
}

export type ManagerLookup = (item: ResultItem) => ItemManager;

function stringValue(item: ResultItem, field: string): string {
  const value = item.fields?.[field];
  return typeof value === 'string' ? value : '';
}

/**
 * Joins each row's manager fields with the repository list from the provisioning settings
 * endpoint, which any signed-in user can read, so the page knows which rows are read-only.
 */
export function useManagerLookup(): ManagerLookup {
  const { data, error, isLoading } = useGetFrontendSettingsQuery(config.provisioningEnabled ? undefined : skipToken);

  const repos = useMemo(() => {
    const items = data?.items ?? [];
    return {
      byName: new Map(items.map((repo) => [repo.name, repo])),
      instance: items.find((repo) => repo.target === 'instance'),
    };
  }, [data]);

  return useCallback(
    (item: ResultItem): ItemManager => {
      const rawKind = stringValue(item, FIELD.managerKind);
      const kind = isManagerKind(rawKind) ? rawKind : undefined;
      const id = stringValue(item, FIELD.managerId) || undefined;
      const base = { isManaged: Boolean(rawKind), kind, id, isOrphaned: false };
      const isRepo = kind === ManagerKind.Repo;

      if (!config.provisioningEnabled) {
        return base;
      }
      // Until the repository list is in, assume anything synced from Git might be read-only.
      if (isLoading) {
        return {
          ...base,
          ...lockBoth(isRepo ? t('urv.provisioned.checking', 'Checking the repository...') : undefined),
        };
      }
      if (error) {
        const reason = t('urv.provisioned.unknown', "Couldn't load the repository, so this can't be changed here");
        return { ...base, ...lockBoth(isRepo ? reason : undefined) };
      }

      const repository = isRepo && id ? repos.byName.get(id) : undefined;
      const isOrphaned = isRepo && !repository;
      // Like the folder view: with an instance-wide repository, everything else belongs to it too.
      const governing = isRepo ? repository : repos.instance;
      const isRootFolder =
        isRepo && groupResourceOf(item.resource) === FOLDER_GROUP_RESOURCE && item.resource.name === id;
      const result = { ...base, repository, isOrphaned };

      if (getIsReadOnlyRepo(governing)) {
        return { ...result, ...lockBoth(getReadOnlyTooltipText({ isLocal: governing?.type === 'local' })) };
      }
      if (isOrphaned) {
        const reason = t(
          'urv.provisioned.orphaned',
          "The repository it was synced from is gone, so it can't be changed here"
        );
        return { ...result, ...lockBoth(reason) };
      }
      if (isRootFolder) {
        // The folder view doesn't offer these either: the root folder comes and goes with the repository.
        const reason = t(
          'urv.provisioned.root-folder',
          "This is the repository's root folder. It's removed when the repository is."
        );
        return { ...result, ...lockBoth(reason) };
      }
      if (!repository) {
        return result;
      }

      // This page saves through the plain API, which commits straight to the repository's branch
      // and takes the folder from the file's path, so a move there would change nothing.
      return {
        ...result,
        moveLockedReason: t(
          'urv.provisioned.move-git',
          'Its folder comes from where the file sits in the repository. Move it from the Dashboards page instead.'
        ),
        deleteLockedReason: repository.workflows.includes('write')
          ? undefined
          : t(
              'urv.provisioned.branch-only',
              'This repository only takes changes through a branch. Delete it from the Dashboards page instead.'
            ),
      };
    },
    [repos, error, isLoading]
  );
}
