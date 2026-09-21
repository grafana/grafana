/**
 * Lists refs for a repository that hasn't been created yet, from the wizard's current form
 * values, via the /reftree subresource (see buildEphemeralRepository on the backend). Used
 * to populate the branch dropdown on ConnectStep before ConnectStep's own submit actually
 * creates anything (see useCreateOrUpdateRepository).
 */
import { useEffect, useMemo } from 'react';

import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useCreateRepositoryReftreeMutation } from 'app/api/clients/provisioning/v0alpha1';

import { DEFAULT_BRANCH_NAMES } from '../../constants';
import { type RepositoryFormData } from '../../types';
import { dataToSpec } from '../../utils/data';

export interface UseGetEphemeralRepositoryRefsProps {
  data: RepositoryFormData;
  connectionName?: string;
}

export function useGetEphemeralRepositoryRefs({ data, connectionName }: UseGetEphemeralRepositoryRefsProps) {
  const [fetchRefs, { data: branchData, isLoading: branchLoading, error: branchError }] =
    useCreateRepositoryReftreeMutation();

  const { url, type, token, tokenUser, email } = data;

  useEffect(() => {
    if (!url) {
      return;
    }
    fetchRefs({ name: 'new', body: { spec: dataToSpec(data, connectionName) } });
    // url/token/etc identify the connection; other fields on `data` (path, title, ...)
    // shouldn't re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, type, token, tokenUser, email, connectionName]);

  const branchOptions = branchData?.items.map((item) => ({ label: item.name, value: item.name })) ?? [];

  const defaultBranch = useMemo(() => {
    if (!branchData?.items?.length) {
      return undefined;
    }
    const names = branchData.items.map((item) => item.name);
    const preferred = DEFAULT_BRANCH_NAMES.find((b) => names.includes(b));
    return preferred ?? [...names].sort()[0];
  }, [branchData]);

  return {
    options: branchOptions,
    defaultBranch,
    loading: branchLoading,
    error: branchError ? getErrorMessage(branchError) : null,
  };
}
