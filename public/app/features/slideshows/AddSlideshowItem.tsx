import { useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getPlaylistItemKinds } from '@grafana/runtime';
import { AsyncSelect, Field, Select, Stack } from '@grafana/ui';

import { type SlideshowItemDraft } from './types';

const SEARCH_LIMIT = 20;

interface Props {
  onAdd: (item: SlideshowItemDraft) => void;
}

export function AddSlideshowItem({ onAdd }: Props) {
  const kinds = getPlaylistItemKinds();
  const [kindIndex, setKindIndex] = useState(0);
  // Remounting the search box after each add clears its text and cached options.
  const [searchKey, setSearchKey] = useState(0);
  const kind = kinds[kindIndex];

  if (!kind) {
    return null;
  }

  const kindOptions = kinds.map((k, i) => ({ label: k.title, value: i, icon: k.icon }));

  const loadOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const results = await kind.search(query, SEARCH_LIMIT);
    return results.map((r) => ({ label: r.title, value: r.name }));
  };

  return (
    <Stack gap={2} alignItems="end">
      <Field noMargin label={t('slideshows.edit.add-kind', 'Kind')}>
        <Select
          inputId="slideshow-kind"
          width={24}
          options={kindOptions}
          value={kindIndex}
          onChange={(v) => {
            setKindIndex(v.value ?? 0);
            setSearchKey((k) => k + 1);
          }}
        />
      </Field>
      <Field noMargin label={t('slideshows.edit.add-item', 'Add')}>
        <AsyncSelect<string>
          key={`${kindIndex}/${searchKey}`}
          inputId="slideshow-add-item"
          width={40}
          defaultOptions
          loadOptions={loadOptions}
          placeholder={t('slideshows.edit.add-placeholder', 'Search {{kind}}...', { kind: kind.title.toLowerCase() })}
          onChange={(v) => {
            if (v.value) {
              onAdd({ group: kind.group, resource: kind.resource, name: v.value });
              setSearchKey((k) => k + 1);
            }
          }}
        />
      </Field>
    </Stack>
  );
}
