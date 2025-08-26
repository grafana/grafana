import { useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useQueryLibraryContext } from '../QueryLibrary/QueryLibraryContext';
import { changeQueries } from '../state/query';
import { selectExploreDSMaps } from '../state/selectors';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const { openDrawer, queryLibraryEnabled } = useQueryLibraryContext();
  const dispatch = useDispatch();
  const exploreActiveDS = useSelector(selectExploreDSMaps);
  const exploreId = exploreActiveDS.exploreToDS[0]?.exploreId;

  const onSelectQuery = (newQuery: DataQuery) => {
    reportInteraction('grafana_explore_query_replaced_from_library');
    if (exploreId) {
      dispatch(changeQueries({ exploreId, queries: [newQuery] }));
    }
  };

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Save query');

  return queryLibraryEnabled && !hasBeenSaved ? (
    <>
      <Button
        variant="secondary"
        aria-label={buttonLabel}
        onClick={() => {
          openDrawer({
            query,
            onSelectQuery,
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
