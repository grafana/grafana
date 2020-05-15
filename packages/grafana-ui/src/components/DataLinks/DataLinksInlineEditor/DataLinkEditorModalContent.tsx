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
  onSave: (index: number, ink: DataLink) => void;
  onCancel: (index: number) => void;
}

export const DataLinkEditorModalContent: FC<DataLinkEditorModalContentProps> = ({
  link,
  index,
  suggestions,
  onSave,
  onCancel,
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
      />
      <HorizontalGroup>
        <Button
          onClick={() => {
            onSave(index, dirtyLink);
          }}
        >
          Save
        </Button>
        <Button variant="secondary" onClick={() => onCancel(index)}>
          Cancel
        </Button>
      </HorizontalGroup>
    </>
  );
};
