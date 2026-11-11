import { type IconName } from '@grafana/data';

export function getIconForKind(kind: string, isOpen?: boolean): IconName {
  if (kind === 'dashboard') {
    return 'apps';
  }

  if (kind === 'folder') {
    return isOpen ? 'folder-open' : 'folder';
  }

  if (kind === 'sharedwithme') {
    return 'users-alt';
  }

  return 'question-circle';
}
