import { Stack } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';

import { LeftActions } from './LeftActions';
import { RightActions } from './RightActions';

interface Props {
  dashboard: DashboardScene;
}

export function ToolbarActionsNew({ dashboard }: Props) {
  return (
    <Stack flex={1} minWidth={0}>
      <LeftActions dashboard={dashboard} />
      <RightActions dashboard={dashboard} />
    </Stack>
  );
}
