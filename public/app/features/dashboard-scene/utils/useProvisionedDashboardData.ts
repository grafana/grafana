import { useState } from 'react';

import { RepositoryView } from 'app/api/clients/provisioning';
import { useUrlParams } from 'app/core/navigation/hooks';
import { WorkflowOption } from 'app/features/provisioning/types';

import { getWorkflowOptions } from '../saving/provisioned/defaults';
import { useDefaultValues } from '../saving/provisioned/hooks';
import { DashboardScene } from '../scene/DashboardScene';

export interface ProvisionedDashboardData {
  isReady: boolean;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  defaultValues: ProvisionedDashboardFormData | null;
  repository: RepositoryView;
  loadedFromRef?: string;
  workflowOptions: Array<{ label: string; value: string }>;
  isNew: boolean;
  isGitHub: boolean;
  readOnly: boolean;
}

export interface ProvisionedDashboardFormData {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  workflow?: WorkflowOption;
  title: string;
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
}

export function useProvisionedDashboardData(dashboard: DashboardScene) {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const [params] = useUrlParams();
  const [isLoading, setIsLoading] = useState(false);
  const loadedFromRef = params.get('ref') ?? undefined;

  const defaultValuesResult = useDefaultValues({
    meta,
    defaultTitle,
    defaultDescription,
    loadedFromRef,
  });

  if (!defaultValuesResult) {
    return {
      isReady: false,
      isLoading,
      setIsLoading,
      defaultValues: null,
      repository: null,
      loadedFromRef,
      workflowOptions: [],
      isNew: false,
      isGitHub: false,
      readOnly: true,
    };
  }

  const { values, isNew, isGitHub, repository } = defaultValuesResult;
  const workflowOptions = getWorkflowOptions(repository, loadedFromRef);
  const readOnly = !repository?.workflows?.length;

  return {
    isReady: true,
    // Raw data
    defaultValues: values,
    repository,
    loadedFromRef,

    // Computed values
    workflowOptions,
    isNew,
    isGitHub,
    readOnly,

    // Shared state
    isLoading,
    setIsLoading,
  };
}
