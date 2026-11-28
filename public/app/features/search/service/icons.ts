import { type IconName } from '@grafana/data';
import { CORE_KINDS, findKindBySearchKind } from 'app/core/kinds/coreKinds';

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (isOpen && kind === CORE_KINDS.folder.searchKind) {
    return 'folder-open';
  }

  if (kind === 'sharedwithme') {
    return 'users-alt';
  }

  return findKindBySearchKind(kind)?.icon ?? 'question-circle';
}
