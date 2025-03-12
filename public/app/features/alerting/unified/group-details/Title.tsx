import { Icon, LinkButton, Stack, Text } from '@grafana/ui';
import { FolderDTO } from 'app/types';

import { useReturnTo } from '../hooks/useReturnTo';

export const Title = ({ name, namespaceId, folder }: { name: string; namespaceId?: string; folder?: FolderDTO }) => {
  const { returnTo } = useReturnTo('/alerting/list');

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton variant="secondary" icon="angle-left" href={returnTo} />
      <Stack direction="row" gap={0} alignItems="center">
        <Stack direction="row" gap={0.5} alignItems="center">
          <Text color="secondary">
            <Icon name="folder" size="xl" />
          </Text>
          <Text variant="h1" truncate>
            {folder?.title ?? namespaceId ?? 'Unknown'}
          </Text>
        </Stack>
        <Text color="secondary">
          <Icon name="angle-right" size="xl" />
        </Text>
        <Text variant="h1" truncate>
          {name}
        </Text>
      </Stack>
    </Stack>
  );
};
