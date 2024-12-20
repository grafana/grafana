import { Icon, IconName, Text } from '@grafana/ui';
import { RepositorySpec, selectRepoByName } from 'app/features/provisioning/api';
import { useSelector } from 'app/types';

export interface Props {
  name?: string;
}

export function FolderRepo({ name }: Props) {
  if (!name) {
    return null;
  }
  return <FolderRepoContent name={name} />;
}

function FolderRepoContent({ name }: Required<Props>) {
  const repo = useSelector((state) => selectRepoByName(state, name));

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
      return [spec.s3?.bucket!, 'cloud'];
    default:
      return ['', 'question-circle'];
  }
}
