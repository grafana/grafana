import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { ToolbarActionProps } from '../types';

export const StarButton = ({ dashboard }: ToolbarActionProps) => {
  return <StarToolbarButton group="dashboard.grafana.app" kind="Dashboard" dashboard={dashboard} />;
};
