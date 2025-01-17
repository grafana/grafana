import { Icon, IconName, Text } from '@grafana/ui';
import { Repository, RepositorySpec } from 'app/features/provisioning/api';

export interface Props {
  repo?: Repository;
}

export function FolderRepo({ repo }: Props) {
  if (!repo) {
    return null;
  }
  return <FolderRepoContent repo={repo} />;
}

function FolderRepoContent({ repo }: Required<Props>) {
  if (!repo || !repo.spec) {
    return null;
  }

  const [repoName, icon] = getRepoDetails(repo.spec);

  return (
    <Text color={'secondary'}>
      {' '}
      | <Icon name={icon} /> {repoName}
    </Text>
  );
}

function getRepoDetails(spec: RepositorySpec): [string, IconName] {
  switch (spec.type) {
    case 'github':
      return [spec.github?.repository!, 'github'];
    case 'local':
      return [spec.local?.path!, 'file-blank'];
    case 's3':
      return [spec.local?.path!, 'cloud'];
    default:
      return ['', 'question-circle'];
  }
}
