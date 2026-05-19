import { GoToSnapshotOriginButton } from '../../GoToSnapshotOriginButton';
import { type ToolbarActionProps } from '../types';

export const OpenSnapshotOriginButton = ({ dashboard }: ToolbarActionProps) => (
  <GoToSnapshotOriginButton originalURL={dashboard.getSnapshotUrl()} />
);
