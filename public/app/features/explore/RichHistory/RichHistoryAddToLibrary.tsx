import { t } from 'i18next';
import React, { useState } from 'react';

import { AppEvents, dateTime } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { isQueryLibraryEnabled, useAddQueryTemplateMutation } from 'app/features/query-library';
import { AddQueryTemplateCommand } from 'app/features/query-library/types';

import { QueryDetails, RichHistoryAddToLibraryForm } from './RichHistoryAddToLibraryForm';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [addQueryTemplate, { isSuccess }] = useAddQueryTemplateMutation();

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

  const submit = (data: QueryDetails) => {
    const timestamp = dateTime().toISOString();
    const temporaryDefaultTitle = data.description || `Imported from Explore - ${timestamp}`;
    handleAddQueryTemplate({ title: temporaryDefaultTitle, targets: [query] });
  };

  return isQueryLibraryEnabled() && !isSuccess ? (
    <>
      <Button variant="secondary" aria-label={buttonLabel} onClick={() => setIsOpen(true)}>
        {buttonLabel}
      </Button>
      <Modal
        title={t('explore.add-to-library-modal.title', 'Add query to Query Library')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <RichHistoryAddToLibraryForm
          onCancel={() => setIsOpen(() => false)}
          query={query}
          onSave={(data) => {
            submit(data);
            setIsOpen(false);
          }}
        />
      </Modal>
    </>
  ) : undefined;
};
