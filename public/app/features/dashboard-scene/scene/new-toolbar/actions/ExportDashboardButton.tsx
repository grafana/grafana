import ExportButton from '../../../sharing/ExportButton/ExportButton';
import { ToolbarActionProps } from '../types';

export const ExportDashboardButton = ({ dashboard }: ToolbarActionProps) => (
  <ExportButton dashboard={dashboard} iconOnly />
);
