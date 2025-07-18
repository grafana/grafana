import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import {
  DeleteRepositoryFilesWithPathApiResponse,
  GetRepositoryFilesWithPathApiResponse,
} from 'app/api/clients/provisioning/v0alpha1';
import { Resource } from 'app/features/apiserver/types';

import { DashboardScene } from '../scene/DashboardScene';

interface RequestHandlers {
  onBranchSuccess?: (data: { ref: string; path: string; urls?: Record<string, string> }) => void;
  onWriteSuccess?: () => void;
  onNewDashboardSuccess?: (resource: Resource<Dashboard>) => void;
  onError?: (error: unknown) => void;
}

interface ProvisionedRequest {
  isError: boolean;
  isSuccess: boolean;
  isLoading?: boolean;
  error?: unknown;
  data?: DeleteRepositoryFilesWithPathApiResponse | GetRepositoryFilesWithPathApiResponse;
}

// This hook handles save new dashboard, edit existing dashboard, and delete dashboard response logic for provisioned dashboards.
export function useProvisionedRequestHandler({
  dashboard,
  request,
  workflow,
  handlers,
  isNew,
}: {
  dashboard: DashboardScene;
  request: ProvisionedRequest;
  workflow?: string;
  handlers: RequestHandlers;
  isNew?: boolean;
}) {
  useEffect(() => {
    if (request.isError) {
      handlers.onError?.(request.error);
      return;
    }

    if (request.isSuccess && request.data) {
      dashboard.setState({ isDirty: false });
      const { ref, path, urls, resource } = request.data;

      // Branch workflow
      if (workflow === 'branch' && ref && path) {
        handlers.onBranchSuccess?.({ ref, path, urls });
        return;
      }

      // Success message (could be configurable)
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [t('dashboard-scene.edit-provisioned-dashboard-form.success', 'Dashboard changes saved successfully')],
      });

      // New dashboard flow
      if (isNew && resource?.upsert && handlers.onNewDashboardSuccess) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        handlers.onNewDashboardSuccess(resource.upsert as Resource<Dashboard>);
        return;
      }

      // Write workflow
      handlers.onWriteSuccess?.();
    }
  }, [request, workflow, handlers, isNew, dashboard]);
}
