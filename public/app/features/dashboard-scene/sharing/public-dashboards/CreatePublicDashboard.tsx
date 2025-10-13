import { SceneComponentProps } from '@grafana/scenes';
import { CreatePublicDashboardBase } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';

import { getDashboardSceneFor } from '../../utils/utils';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';
import { useUnsupportedDatasources } from './hooks';

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const dashboard = getDashboardSceneFor(model);
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <CreatePublicDashboardBase
      dashboard={dashboard}
      unsupportedDatasources={unsupportedDataSources}
      unsupportedTemplateVariables={hasTemplateVariables}
    />
  );
}
