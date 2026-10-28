import { type RepositorySelectProps } from '@grafana/runtime';

import { useResourceRepositorySelection } from '../../hooks/useResourceRepositorySelection';
import { getDefaultKindInfo, getKindInfoByGroupKind, type ResourceKindInfo } from '../../utils/resourceKinds';

import { RepositorySelect } from './RepositorySelect';

export function RepositorySelectForKind({ group, kind, ...props }: RepositorySelectProps) {
  const info = getKindInfoByGroupKind(group, kind) ?? getDefaultKindInfo(group, kind);
  return <KindRepositorySelect info={info} {...props} />;
}

function KindRepositorySelect({ info, ...props }: Omit<RepositorySelectProps, 'group' | 'kind'> & { info: ResourceKindInfo }) {
  const { isAvailable, repositories } = useResourceRepositorySelection(info);
  return isAvailable ? <RepositorySelect repositories={repositories} {...props} /> : null;
}
