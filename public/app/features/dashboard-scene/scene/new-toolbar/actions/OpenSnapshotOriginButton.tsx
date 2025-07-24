import { GoToSnapshotOriginButton } from '../../GoToSnapshotOriginButton';
import { ToolbarActionProps } from '../types';

export const OpenSnapshotOriginButton = ({ dashboard }: ToolbarActionProps) => (
  <GoToSnapshotOriginButton originalURL={dashboard.getSnapshotUrl() ?? ''} />
);
