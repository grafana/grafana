import { t } from 'i18next';
import React, { useState } from 'react';

import { AppEvents, dateTime } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { isQueryLibraryEnabled, useAddQueryTemplateMutation } from 'app/features/query-library';
import { AddQueryTemplateCommand } from 'app/features/query-library/types';

import { RichHistoryAddToLibraryModal } from './RichHistoryAddToLibraryModal';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [addQueryTemplate, { isSuccess }] = useAddQueryTemplateMutation();
  const [showModal, setShowModal] = useState(false);

  const handleAddQueryTemplate = async (addQueryTemplateCommand: AddQueryTemplateCommand) => {
    const result = await addQueryTemplate(addQueryTemplateCommand);
    if (!result.error) {
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t('explore.rich-history-card.query-template-added', 'Query template successfully added to the library'),
        ],
      });
    }
  };

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  const submit = () => {
    const timestamp = dateTime().toISOString();
    const temporaryDefaultTitle = `Imported from Explore - ${timestamp}`;
    handleAddQueryTemplate({ title: temporaryDefaultTitle, targets: [query] });
  };

  return isQueryLibraryEnabled() && !isSuccess ? (
    <Button variant="secondary" aria-label={buttonLabel} onClick={() => setShowModal(true)}>
      {buttonLabel}
      <Modal
        title={t('explore.add-to-library-modal.title', 'Add query to Query Library')}
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
      >
        <RichHistoryAddToLibraryModal
          onCancel={() => setShowModal(false)}
          onSave={() => {
            submit();
            setShowModal(false);
          }}
        />
      </Modal>
    </Button>
  ) : undefined;
};
