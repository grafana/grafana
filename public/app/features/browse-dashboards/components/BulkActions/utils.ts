import { Folder } from 'app/api/clients/folder/v1beta1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { WorkflowOption } from 'app/features/provisioning/types';

import { DashboardTreeSelection } from '../../types';

export type BulkActionFormData = {
  comment: string;
  ref: string;
  workflow?: WorkflowOption;
};

export interface BulkActionProvisionResourceProps {
  folderUid?: string;
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  onDismiss?: () => void;
}

export type BulkSuccessResponse<T, K> = Array<{
  index: number;
  item: T;
  data: K;
}>;

export type MoveResultSuccessState = {
  allSuccess: boolean;
  repoUrl?: string;
};

export function getTargetFolderPathInRepo({ targetFolder }: { targetFolder?: Folder }): string | undefined {
  if (!targetFolder) {
    return undefined;
  }
  const folderAnnotations = targetFolder.metadata.annotations || {};
  return folderAnnotations[AnnoKeySourcePath] || targetFolder.metadata.name || '';
}
