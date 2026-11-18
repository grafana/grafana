import { type ComponentSize } from '@grafana/ui';

import { getDraftDashboardExtension } from '../../../saving/enterprise-components/DraftDashboardExtension';
import { type ToolbarActionProps } from '../types';

export const PublishDraftButton = ({ dashboard, size }: ToolbarActionProps & { size?: ComponentSize }) => {
  const PublishButton = getDraftDashboardExtension()?.PublishButton;
  return PublishButton ? <PublishButton dashboard={dashboard} size={size} /> : null;
};
