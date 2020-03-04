import { DataFrame, DataLink, VariableSuggestion } from '@grafana/data';
import React, { FC, useState } from 'react';
import { DataLinkEditor } from '../DataLinkEditor';
import { HorizontalGroup } from '../../Layout/Layout';
import Forms from '../../Forms';

interface DataLinkEditorModalContentProps {
  link: DataLink;
  index: number;
  data: DataFrame[];
  suggestions: VariableSuggestion[];
  onChange: (index: number, ink: DataLink) => void;
  onClose: () => void;
}

export const DataLinkEditorModalContent: FC<DataLinkEditorModalContentProps> = ({
  link,
  index,
  suggestions,
  onChange,
  onClose,
}) => {
  const [dirtyLink, setDirtyLink] = useState(link);
  return (
    <>
      <DataLinkEditor
        value={dirtyLink}
        index={index}
        isLast={false}
        suggestions={suggestions}
        onChange={(index, link) => {
          setDirtyLink(link);
        }}
        onRemove={() => {}}
      />
      <HorizontalGroup>
        <Forms.Button
          onClick={() => {
            onChange(index, dirtyLink);
            onClose();
          }}
        >
          Save
        </Forms.Button>
        <Forms.Button variant="secondary" onClick={() => onClose()}>
          Cancel
        </Forms.Button>
      </HorizontalGroup>
    </>
  );
};
