import { getDraftDashboardExtension } from '../../../saving/enterprise-components/DraftDashboardExtension';
import { type ToolbarActionProps } from '../types';

export const DraftDashboardBadge = ({ dashboard }: ToolbarActionProps) => {
  const { meta } = dashboard.useState();
  const DraftBadge = getDraftDashboardExtension()?.DraftBadge;
  return DraftBadge && dashboard.isDraft(meta) ? <DraftBadge dashboard={dashboard} /> : null;
};
