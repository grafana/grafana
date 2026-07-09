import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { useReturnTo } from '../../hooks/useReturnTo';

export const Title = ({ name, returnToFallback }: { name: string; returnToFallback: string }) => {
  const { returnTo } = useReturnTo(returnToFallback);
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();

  return (
    <Stack direction="row" gap={1} minWidth={0} alignItems="center">
      <LinkButton
        aria-label={t('alerting.title.aria-label-return-to', 'Return to previous view')}
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
