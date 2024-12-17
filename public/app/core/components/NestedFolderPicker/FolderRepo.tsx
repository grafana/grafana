import { Icon, Text } from '@grafana/ui';

export interface Props {
  name?: string;
}

export function FolderRepo({ name }: Props) {
  if (!name) {
    return null;
  }
  return (
    <Text color={'secondary'}>
      {' '}
      | <Icon name={'github'} /> {name}
    </Text>
  );
}
