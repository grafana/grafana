import { useCallback, useMemo, useState } from 'react';

import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { ResourceRef } from '../components/BulkActions/useBulkActionJob';

export interface UseOrphanedResourceActionsOptions {
  uid: string;
  resourceType: 'dashboards' | 'folders';
}

export interface UseOrphanedResourceActionsResult {
  resourceRef: ResourceRef;
  submit: (action: 'release' | 'delete') => Promise<Job>;
  submitRelease: () => Promise<Job>;
  submitDelete: () => Promise<Job>;
  isSubmitting: boolean;
  error: unknown;
  clearError: () => void;
}

export function useOrphanedResourceActions({
  uid,
  resourceType,
}: UseOrphanedResourceActionsOptions): UseOrphanedResourceActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const resourceRef = useMemo<ResourceRef>(
    () => ({
      group: resourceType === 'dashboards' ? 'dashboard.grafana.app' : 'folder.grafana.app',
      kind: resourceType === 'dashboards' ? 'Dashboard' : 'Folder',
      name: uid,
    }),
    [resourceType, uid]
  );

  const submit = useCallback(
    async (_action: 'release' | 'delete') => {
      const target: ResourceRef = {
        group: resourceType === 'dashboards' ? 'dashboard.grafana.app' : 'folder.grafana.app',
        kind: resourceType === 'dashboards' ? 'Dashboard' : 'Folder',
        name: uid,
      };

      setIsSubmitting(true);
      setError(null);

      try {
        await Promise.resolve();
        // TODO: POST orphan action with { action, target } (see file comment).
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [uid, resourceType]
  );

  const submitRelease = useCallback(() => submit('release'), [submit]);
  const submitDelete = useCallback(() => submit('delete'), [submit]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { resourceRef, submit, submitRelease, submitDelete, isSubmitting, error, clearError };
}
