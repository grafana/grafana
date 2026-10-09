import { type provisioning } from '@grafana/runtime';

import { useResourceRepositorySelection } from '../../hooks/useResourceRepositorySelection';
import { addResourceKinds, getKindInfoByGroupKind } from '../../utils/resourceKinds';

import { RepositorySelect } from './RepositorySelect';

/** `provisioning.RepositorySelect` in `@grafana/runtime`. */
export function RepositorySelectForKind({ group, kind, value, onChange }: provisioning.RepositorySelectProps) {
  let info = getKindInfoByGroupKind(group, kind);
  if (!info) {
    addResourceKinds([{ group, kind }]);
    info = getKindInfoByGroupKind(group, kind)!;
  }
  const { isAvailable, repositories } = useResourceRepositorySelection(info);
  if (!isAvailable) {
    return null;
  }
  return <RepositorySelect repositories={repositories} value={value} onChange={onChange} />;
}
