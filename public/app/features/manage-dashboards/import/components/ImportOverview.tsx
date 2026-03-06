import { locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { DashboardInputs, DashboardSource } from '../../types';

import { ImportOverviewV1 } from './ImportOverviewV1';
import { ImportOverviewV2 } from './ImportOverviewV2';

type Props = {
  dashboard: unknown;
  inputs: DashboardInputs;
  meta: { updatedAt: string; orgName: string };
  source: DashboardSource;
  onCancel: () => void;
};

export function ImportOverview({ dashboard, inputs, meta, source, onCancel }: Props) {
  const searchObj = locationService.getSearchObject();
  const folderUid = searchObj.folderUid ? String(searchObj.folderUid) : '';

  if (isDashboardV2Spec(dashboard)) {
    return (
      <ImportOverviewV2
        dashboard={dashboard}
        inputs={inputs}
        meta={meta}
        source={source}
        folderUid={folderUid}
        onCancel={onCancel}
      />
    );
  }

  return (
    <ImportOverviewV1
      dashboard={dashboard as Dashboard}
      inputs={inputs}
      meta={meta}
      source={source}
      folderUid={folderUid}
      onCancel={onCancel}
    />
  );
}
