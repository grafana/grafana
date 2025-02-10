import { useState } from 'react';

import { DataFrame, DataLink, VariableSuggestion } from '@grafana/data';

import { Trans } from '../../../utils/i18n';
import { Button } from '../../Button';
import { Modal } from '../../Modal/Modal';
import { DataLinkEditor } from '../DataLinkEditor';

interface DataLinkEditorModalContentProps {
  link: DataLink;
  index: number;
  data: DataFrame[];
  getSuggestions: () => VariableSuggestion[];
  onSave: (index: number, ink: DataLink) => void;
  onCancel: (index: number) => void;
  showOneClick?: boolean;
}

export const DataLinkEditorModalContent = ({
  link,
  index,
  onSave,
  onCancel,
  getSuggestions,
  showOneClick,
}: DataLinkEditorModalContentProps) => {
  const [dirtyLink, setDirtyLink] = useState(link);
  return (
    <>
      <DataLinkEditor
        value={dirtyLink}
        index={index}
        isLast={false}
        onChange={(index, link) => {
          setDirtyLink(link);
        }}
        suggestions={getSuggestions()}
        showOneClick={showOneClick}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel(index)} fill="outline">
          <Trans i18nKey="grafana-ui.data-link-editor-modal.cancel">Cancel</Trans>
        </Button>
        <Button
          onClick={() => {
            onSave(index, dirtyLink);
          }}
          disabled={dirtyLink.title.trim() === '' || dirtyLink.url.trim() === ''}
        >
          <Trans i18nKey="grafana-ui.data-link-editor-modal.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
};
