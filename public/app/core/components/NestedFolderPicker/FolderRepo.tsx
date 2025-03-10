import { Badge } from '@grafana/ui';
import { RepositoryView } from 'app/features/provisioning/api';

export interface Props {
  repo?: RepositoryView | string;
}

export function FolderRepo({ repo }: Props) {
  if (!repo || (typeof repo !== 'string' && repo.target === 'instance')) {
    return null;
  }

  return <Badge text={'Provisioned'} color={'darkgrey'} />;
}
