import { Badge } from '@grafana/ui';
import { RepositoryView } from 'app/features/provisioning/api';

export interface Props {
  repo?: RepositoryView;
}

export function FolderRepo({ repo }: Props) {
  if (!repo) {
    return null;
  }

  return <Badge text={'Provisioned'} color={'darkgrey'} style={{ marginLeft: 8 }} />;
  // const [repoName, icon] = getRepoDetails(repo);
  //
  // return (
  //   <Text color={'secondary'}>
  //     {' '}
  //     | <Icon name={icon} /> {repoName}
  //   </Text>
  // );
}

// function getRepoDetails(spec: RepositoryView): [string, IconName] {
//   switch (spec.type) {
//     case 'github':
//       return [spec.title ?? '', 'github'];
//     case 'local':
//       return [spec.title ?? '', 'file-blank'];
//     case 's3':
//       return [spec.title ?? '', 'cloud'];
//     default:
//       return ['', 'question-circle'];
//   }
// }
