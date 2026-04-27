import type { DataLink, VariableSuggestion } from '@grafana/data/types';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
import { DataLinksInlineEditorBase, type DataLinksInlineEditorBaseProps } from './DataLinksInlineEditorBase';

type DataLinksInlineEditorProps = Omit<DataLinksInlineEditorBaseProps<DataLink>, 'children' | 'type' | 'items'> & {
  links?: DataLink[];
  showOneClick?: boolean;
  getSuggestions: () => VariableSuggestion[];
};

export const DataLinksInlineEditor = ({
  links,
  getSuggestions,
  showOneClick = false,
  ...rest
}: DataLinksInlineEditorProps) => (
  <DataLinksInlineEditorBase<DataLink> type="link" items={links} data-testid="links-inline" {...rest}>
    {(item, index, onSave, onCancel) => (
      <DataLinkEditorModalContent
        index={index}
        link={item ?? { title: '', url: '' }}
        data={rest.data}
        onSave={onSave}
        onCancel={onCancel}
        getSuggestions={getSuggestions}
        showOneClick={showOneClick}
      />
    )}
  </DataLinksInlineEditorBase>
);
