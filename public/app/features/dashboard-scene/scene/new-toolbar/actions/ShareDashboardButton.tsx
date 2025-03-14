import ShareButton from '../../../sharing/ShareButton/ShareButton';
import { ToolbarActionProps } from '../types';

export const ShareDashboardButton = ({ dashboard }: ToolbarActionProps) => (
  <ShareButton dashboard={dashboard} variant={dashboard.state.isEditing ? 'secondary' : 'primary'} />
);
