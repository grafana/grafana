import { type IconName } from '@grafana/data';
import { CORE_KINDS } from 'app/core/kinds/coreKinds';

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (kind === 'dashboard') {
    return CORE_KINDS.dashboard.icon;
  }

  if (kind === 'folder') {
    return isOpen ? 'folder-open' : CORE_KINDS.folder.icon;
  }

  if (kind === 'sharedwithme') {
    return 'users-alt';
  }

  return 'question-circle';
}
