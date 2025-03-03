import { useState } from 'react';

import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useQueryLibraryContext } from '../QueryLibrary/QueryLibraryContext';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const { openAddQueryModal, queryLibraryEnabled } = useQueryLibraryContext();

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  return queryLibraryEnabled && !hasBeenSaved ? (
    <>
      <Button
        variant="secondary"
        aria-label={buttonLabel}
        onClick={() => {
          openAddQueryModal(query, { onSave: () => setHasBeenSaved(true), context: 'richHistory' });
        }}
      >
        {buttonLabel}
      </Button>
    </>
  ) : undefined;
};
