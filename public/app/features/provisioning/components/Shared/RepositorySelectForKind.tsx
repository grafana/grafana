import { type RepositorySelectProps } from '@grafana/runtime';

import { useResourceRepositorySelection } from '../../hooks/useResourceRepositorySelection';
import { resolveKindInfo } from '../../utils/resourceKinds';

import { RepositorySelect } from './RepositorySelect';

export function RepositorySelectForKind({ group, kind, ...props }: RepositorySelectProps) {
  const { isAvailable, repositories } = useResourceRepositorySelection(resolveKindInfo(group, kind));
  return isAvailable ? <RepositorySelect repositories={repositories} {...props} /> : null;
}
