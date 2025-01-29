import { DataLink, VariableSuggestion } from '@grafana/data';

import { DataLinkEditorModalContent } from './DataLinkEditorModalContent';
import { DataLinksInlineEditorBase, DataLinksInlineEditorBaseProps } from './DataLinksInlineEditorBase';

type DataLinksInlineEditorProps = Omit<DataLinksInlineEditorBaseProps<DataLink>, 'children' | 'title' | 'items'> & {
  links?: DataLink[];
  showOneClick?: boolean;
  getSuggestions: () => VariableSuggestion[];
};

export const DataLinksInlineEditor = ({ links, getSuggestions, showOneClick, ...rest }: DataLinksInlineEditorProps) => (
  <DataLinksInlineEditorBase<DataLink> title="Edit link" items={links} {...rest}>
    {(item, index, onSave, onCancel) => (
      <DataLinkEditorModalContent
        index={index}
        link={item ?? { title: '', url: '' }}
        data={rest.data}
        onSave={onSave}
        onCancel={onCancel}
        getSuggestions={getSuggestions}
        showOneClick={showOneClick ?? false}
      />
    )}
  </DataLinksInlineEditorBase>
);
