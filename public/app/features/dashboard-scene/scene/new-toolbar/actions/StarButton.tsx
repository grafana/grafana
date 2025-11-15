import { StarToolbarButton } from 'app/features/stars/StarToolbarButton';

import { ToolbarActionProps } from '../types';

export const StarButton = ({ dashboard }: ToolbarActionProps) => {
  const { uid, title } = dashboard.useState();
  if (!uid) {
    return null;
  }

  return <StarToolbarButton group="dashboard.grafana.app" kind="Dashboard" id={uid} title={title} />;
};
