import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { InlineField, MultiCombobox } from '@grafana/ui';

interface ContentProviderSelectorProps {
  availableProviders: string[];
  selectedProviderValues: Array<{ value: string; label: string }>;
  onProviderChange: (selected: Array<{ value?: string }>) => void;
}

/**
 * Component for selecting content providers
 */
export function ContentProviderSelector({
  availableProviders,
  selectedProviderValues,
  onProviderChange,
}: ContentProviderSelectorProps): JSX.Element {
  const handleProviderChange = useCallback(
    (selected: Array<{ value?: string }>) => {
      const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
      const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
      onProviderChange(newValue.map((value) => ({ value })));
    },
    [availableProviders.length, onProviderChange]
  );

  return (
    <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
      <MultiCombobox
        options={selectedProviderValues}
        value={selectedProviderValues}
        onChange={handleProviderChange}
        placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
        width="auto"
        enableAllOption
        minWidth={20}
        maxWidth={30}
      />
    </InlineField>
  );
}
