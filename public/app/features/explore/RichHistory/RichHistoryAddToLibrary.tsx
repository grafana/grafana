import { t } from 'i18next';
import { useState } from 'react';

import { DataQuery } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { isQueryLibraryEnabled } from 'app/features/query-library';

import { AddToLibraryForm } from '../QueryLibrary/AddToLibraryForm';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenSaved, setHasBeenSaved] = useState(false);

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  return isQueryLibraryEnabled() && !hasBeenSaved ? (
    <>
      <Button variant="secondary" aria-label={buttonLabel} onClick={() => setIsOpen(true)}>
        {buttonLabel}
      </Button>
      <Modal
        title={t('explore.add-to-library-modal.title', 'Add query to Query Library')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <AddToLibraryForm
          onCancel={() => setIsOpen(() => false)}
          query={query}
          onSave={(isSuccess) => {
            if (isSuccess) {
              setIsOpen(false);
              setHasBeenSaved(true);
            }
          }}
        />
      </Modal>
    </>
  ) : undefined;
};
