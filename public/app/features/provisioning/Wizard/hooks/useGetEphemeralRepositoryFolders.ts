/**
 * Lists files (and derives folder suggestions from their paths) for a repository that
 * hasn't been created yet, from the wizard's current form values, via the /filetree
 * subresource (see buildEphemeralRepository on the backend). Used to populate the path
 * dropdown on ConnectStep before ConnectStep's own submit actually creates anything (see
 * useCreateOrUpdateRepository).
 */
import { useEffect, useMemo } from 'react';

import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useCreateRepositoryFiletreeMutation } from 'app/api/clients/provisioning/v0alpha1';

import { isFileItem } from '../../hooks/useGetRepositoryFolders';
import { type RepositoryFormData } from '../../types';
import { dataToSpec } from '../../utils/data';

export interface UseGetEphemeralRepositoryFoldersProps {
  data: RepositoryFormData;
  connectionName?: string;
  token?: string;
  ref?: string;
}

export function useGetEphemeralRepositoryFolders({
  data,
  connectionName,
  token,
  ref,
}: UseGetEphemeralRepositoryFoldersProps) {
  const [fetchFiles, { data: filesData, isLoading: isFilesLoading, error: filesError }] =
    useCreateRepositoryFiletreeMutation();

  const { url, type, tokenUser, email } = data;

  useEffect(() => {
    if (!url) {
      return;
    }
    fetchFiles({
      name: 'new',
      ref,
      body: { spec: dataToSpec(data, connectionName), secure: token ? { token: { create: token } } : undefined },
    });
    // url/token/etc identify the connection; other fields on `data` (path, title, ...)
    // shouldn't re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, type, token, tokenUser, email, connectionName, ref]);

  const options = useMemo(() => {
    const folders = new Set<string>();

    for (const file of filesData?.items ?? []) {
      if (!isFileItem(file) || file.path.startsWith('.')) {
        continue;
      }

      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }

    return Array.from(folders)
      .sort()
      .map((path) => ({ label: path, value: path }));
  }, [filesData]);

  return {
    options,
    loading: isFilesLoading,
    error: filesError ? getErrorMessage(filesError) : null,
  };
}
