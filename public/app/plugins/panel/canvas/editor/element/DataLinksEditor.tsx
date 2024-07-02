import { StandardEditorProps, DataLink } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { CanvasElementOptions } from '../../panelcfg.gen';

type Props = StandardEditorProps<DataLink[], CanvasElementOptions>;

export function DataLinksEditor({ value, onChange, item }: Props) {
  if (!value) {
    value = [];
  }

  const settings = item.settings;

  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
      oneClickEnabled={settings?.oneClickLinks}
    />
  );
}
