import { t } from '@grafana/i18n';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { useReturnTo } from '../hooks/useReturnTo';

export const Title = ({ name }: { name: string }) => {
  const { returnTo } = useReturnTo('/alerting/list');

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton
        aria-label={t('alerting.group-details.title.back', 'Back to alerting')}
        variant="secondary"
        icon="angle-left"
        href={returnTo}
      />
      <Text element="h1" truncate>
        {name}
      </Text>
    </Stack>
  );
};
