import React, { useCallback } from 'react';

import { StandardEditorProps, DataLink } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

type Props = StandardEditorProps<DataLink[]>;

export function DataLinksEditor({ value, onChange, item }: Props) {
  if (!value) {
    value = [];
  }
  const itemSettings = item.settings;
  const element = itemSettings?.element;

  const onDataLinksChange = useCallback(
    (links: DataLink[]) => {
      onChange([...links]);
    },
    [onChange]
  );

  element.data.links = value;

  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onDataLinksChange}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
    />
  );
}
