import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { useReturnTo } from '../hooks/useReturnTo';

export const Title = ({ name }: { name: string }) => {
  const { returnTo } = useReturnTo('/alerting/list');
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton
        aria-label={t('alerting.group-details.title.back', 'Back to alerting')}
        variant="secondary"
        icon="angle-left"
        href={returnTo}
      />
      <Text
        element="h1"
        variant={visualRefreshEnabled ? 'h4' : 'h1'}
        weight={visualRefreshEnabled ? 'bold' : 'regular'}
        truncate
      >
        {name}
      </Text>
    </Stack>
  );
};
