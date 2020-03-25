import { DataFrame, DataLink, VariableSuggestion } from '@grafana/data';
import React, { FC, useState } from 'react';
import { DataLinkEditor } from '../DataLinkEditor';
import { HorizontalGroup } from '../../Layout/Layout';
import { Button } from '../../Button';

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
        <Button
          onClick={() => {
            onChange(index, dirtyLink);
            onClose();
          }}
        >
          Save
        </Button>
        <Button variant="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
      </HorizontalGroup>
    </>
  );
};
