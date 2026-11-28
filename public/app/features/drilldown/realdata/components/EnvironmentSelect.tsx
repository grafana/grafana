import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Stack, Text } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { environmentParam } from '../../environment';
import { SCOPE_VALUES } from '../liveScenario';

// No environment is named this, so it stands for the filter being off.
const ALL = '__all__';

export function EnvironmentSelect() {
  const [queryParams, updateQueryParams] = useQueryParams();
  const chosen = queryParams[environmentParam];
  const selected = typeof chosen === 'string' && chosen ? chosen : undefined;

  // With no environment in the traces there is nothing to filter by.
  if (SCOPE_VALUES.environment.length === 0 && !selected) {
    return null;
  }

  // A link can name an environment the traces no longer hold, and the select still has to show it.
  const environments = [...new Set([...(selected ? [selected] : []), ...SCOPE_VALUES.environment])];
  const options: Array<ComboboxOption<string>> = [
    { value: ALL, label: t('drilldown-real.environment.all', 'All') },
    ...environments.map((value) => ({ value })),
  ];

  return (
    <Stack alignItems="center" gap={1}>
      <Text variant="bodySmall" color="secondary">
        {t('drilldown-real.environment.label', 'Environment')}
      </Text>
      <Combobox
        width={20}
        options={options}
        value={selected ?? ALL}
        aria-label={t('drilldown-real.environment.label', 'Environment')}
        onChange={(option) => updateQueryParams({ [environmentParam]: option.value === ALL ? null : option.value })}
      />
    </Stack>
  );
}
