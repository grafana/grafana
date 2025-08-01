import { useState } from 'react';

import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';

import { useQueryLibraryContext } from '../QueryLibrary/QueryLibraryContext';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  return queryLibraryEnabled && !hasBeenSaved ? (
    <>
      <Button
        variant="secondary"
        aria-label={buttonLabel}
        onClick={() => {
          openDrawer({
            query,
            options: {
              onSave: () => {
                setHasBeenSaved(true);
              },
              context: 'rich-history',
            },
          });
        }}
      >
        {buttonLabel}
      </Button>
    </>
  ) : undefined;
};
