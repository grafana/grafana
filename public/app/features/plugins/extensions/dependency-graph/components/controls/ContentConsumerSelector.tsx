import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { InlineField, MultiCombobox } from '@grafana/ui';

interface ContentConsumerSelectorProps {
  activeConsumers: string[];
  selectedConsumerValues: Array<{ value: string; label: string }>;
  onConsumerChange: (selected: Array<{ value?: string }>) => void;
}

/**
 * Component for selecting content consumers
 */
export function ContentConsumerSelector({
  activeConsumers,
  selectedConsumerValues,
  onConsumerChange,
}: ContentConsumerSelectorProps): JSX.Element {
  const handleConsumerChange = useCallback(
    (selected: Array<{ value?: string }>) => {
      const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
      const isDefaultSelection =
        selectedValues.length === activeConsumers.length &&
        activeConsumers.every((consumer) => selectedValues.includes(consumer));
      const newValue = isDefaultSelection ? [] : selectedValues;
      onConsumerChange(newValue.map((value) => ({ value })));
    },
    [activeConsumers, onConsumerChange]
  );

  return (
    <InlineField label={t('extensions.content-consumer.label', 'Content consumer')}>
      <MultiCombobox
        options={selectedConsumerValues}
        value={selectedConsumerValues}
        onChange={handleConsumerChange}
        placeholder={t(
          'extensions.content-consumer.placeholder',
          'Select content consumers to display (active consumers by default)'
        )}
        width="auto"
        enableAllOption
        minWidth={20}
        maxWidth={30}
      />
    </InlineField>
  );
}
