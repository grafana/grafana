import { type IconName } from '@grafana/data';
import { findKindBySearchKind } from 'app/core/kinds/registry';

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (kind === 'folder' && isOpen) {
    return 'folder-open';
  }

  if (kind === 'sharedwithme') {
    return 'users-alt';
  }

  return findKindBySearchKind(kind)?.icon ?? 'question-circle';
}
