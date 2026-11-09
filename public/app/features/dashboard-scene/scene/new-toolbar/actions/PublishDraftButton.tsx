import { getDraftDashboardExtension } from '../../../saving/enterprise-components/DraftDashboardExtension';
import { type ToolbarActionProps } from '../types';

export const PublishDraftButton = ({ dashboard }: ToolbarActionProps) => {
  const PublishButton = getDraftDashboardExtension()?.PublishButton;
  return PublishButton ? <PublishButton dashboard={dashboard} /> : null;
};
