import { LinkButton, Stack, Text } from '@grafana/ui';

import { useReturnTo } from '../hooks/useReturnTo';

export const Title = ({ name }: { name: string }) => {
  const { returnTo } = useReturnTo('/alerting/list');

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton variant="secondary" icon="angle-left" href={returnTo} />
      <Text element="h1" truncate>
        {name}
      </Text>
    </Stack>
  );
};
