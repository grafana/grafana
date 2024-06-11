import React, { useCallback } from 'react';

import { StandardEditorProps, DataLink } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

type Props = StandardEditorProps<DataLink[]>;

export function DataLinksEditor({ value, onChange }: Props) {
  if (!value) {
    value = [];
  }

  const onDataLinksChange = useCallback(
    (links: DataLink[]) => {
      onChange([...links]);
    },
    [onChange]
  );

  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onDataLinksChange}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
    />
  );
}
