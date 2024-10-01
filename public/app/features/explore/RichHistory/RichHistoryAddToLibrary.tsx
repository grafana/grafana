import { t } from 'i18next';
import { useState } from 'react';

import { DataQuery } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { isQueryLibraryEnabled } from 'app/features/query-library';

import {
  queryLibraryTrackAddFromQueryHistory,
  queryLibraryTrackAddFromQueryHistoryAddModalShown,
} from '../QueryLibrary/QueryLibraryAnalyticsEvents';
import { QueryTemplateForm } from '../QueryLibrary/QueryTemplateForm';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenSaved, setHasBeenSaved] = useState(false);

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  return isQueryLibraryEnabled() && !hasBeenSaved ? (
    <>
      <Button
        variant="secondary"
        aria-label={buttonLabel}
        onClick={() => {
          setIsOpen(true);
          queryLibraryTrackAddFromQueryHistoryAddModalShown();
        }}
      >
        {buttonLabel}
      </Button>
      <Modal
        title={t('explore.query-template-modal.add-title', 'Add query to Query Library')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <QueryTemplateForm
          onCancel={() => setIsOpen(() => false)}
          queryToAdd={query}
          onSave={(isSuccess) => {
            if (isSuccess) {
              setIsOpen(false);
              setHasBeenSaved(true);
              queryLibraryTrackAddFromQueryHistory(query.datasource?.type || '');
            }
          }}
        />
      </Modal>
    </>
  ) : undefined;
};
