import { type RepositorySelectV1Props } from '@grafana/data';

import { useResourceRepositorySelection } from '../../hooks/useResourceRepositorySelection';
import { getSaveableKind } from '../../utils/resourceKinds';

import { RepositorySelect } from './RepositorySelect';

export function RepositorySelectForKind({ group, kind, ...props }: RepositorySelectV1Props) {
  const { isAvailable, repositories } = useResourceRepositorySelection(getSaveableKind(group, kind));
  return isAvailable ? <RepositorySelect repositories={repositories} {...props} /> : null;
}
