import { css } from '@emotion/css';
// BMC Code : Accessibility Change ( Next 1 lines )
import { useState, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ToolbarButton, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { useSelector } from 'app/types';

import { createDatasourcesList } from '../../core/utils/richHistory';
import { MIXED_DATASOURCE_NAME } from '../../plugins/datasource/mixed/MixedDataSource';

import { useQueryLibraryContext } from './QueryLibrary/QueryLibraryContext';
import { type OnSelectQueryType } from './QueryLibrary/types';
import { selectExploreDSMaps } from './state/selectors';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  addQueryRowButtonHidden?: boolean;
  richHistoryRowButtonHidden?: boolean;
  queryInspectorButtonActive?: boolean;

  onClickAddQueryRowButton: () => void;
  onClickQueryInspectorButton: () => void;
  onSelectQueryFromLibrary: OnSelectQueryType;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerMargin: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
  };
};

export function SecondaryActions({
  addQueryRowButtonDisabled,
  addQueryRowButtonHidden,
  onClickAddQueryRowButton,
  onClickQueryInspectorButton,
  onSelectQueryFromLibrary,
  queryInspectorButtonActive,
}: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const exploreActiveDS = useSelector(selectExploreDSMaps);
  // Prefill the query library filter with the dataSource.
  // Get current dataSource that is open. As this is only used in Explore we get it from Explore state.
  const listOfDatasources = createDatasourcesList();
  const activeDatasources = exploreActiveDS.dsToExplore
    .map((eDs) => {
      return listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name;
    })
    .filter((name): name is string => !!name && name !== MIXED_DATASOURCE_NAME);

  const { queryLibraryEnabled, openDrawer: openQueryLibraryDrawer } = useQueryLibraryContext();

  // BMC Code : Accessibility Change starts here.  | added useRef for query row & focus after adding query
  const [addedQuery, setAddedQuery] = useState(false);
  const [queryCount, setQueryCount] = useState('A');
  const addQueryButtonRef = useRef<HTMLButtonElement>(null);

  const onClickAddQueryRowBtn = () => {
    onClickAddQueryRowButton();
    setAddedQuery(true);
    setQueryCount((prevCount) => {
      const nextLetter = prevCount.charCodeAt(0) + 1;
      return nextLetter > 90 ? 'A' : String.fromCharCode(nextLetter);
    });
  };

  // BMC Code : Accessibility Change ends here.

  return (
    <div className={styles.containerMargin}>
      {
        // BMC Code : Accessibility Change starts here. | screen reader announcement hidden div
      }
      <div aria-live="polite" className="sr-only" id={`queryCount-${queryCount}`}>
        {addedQuery && (
          <Trans i18nKey="bmcgrafana.explore.query-added-announcement">New Query Row Added. {queryCount}</Trans>
        )}
      </div>
      {
        // BMC Code : Accessibility Change ends here.
      }
      {!addQueryRowButtonHidden && (
        <>
          <ToolbarButton
            variant="canvas"
            aria-label={t('explore.secondary-actions.query-add-button-aria-label', 'Add query')}
            // BMC Code : modified onClick handler.
            onClick={onClickAddQueryRowBtn}
            disabled={addQueryRowButtonDisabled}
            icon="plus"
            // BMC Code : useRef & tabInex added.
            ref={addQueryButtonRef}
            tabIndex={0}
          >
            <Trans i18nKey="explore.secondary-actions.query-add-button">Add query</Trans>
          </ToolbarButton>
          {queryLibraryEnabled && (
            <ToolbarButton
              aria-label={t('explore.secondary-actions.add-from-query-library', 'Add query from library')}
              variant="canvas"
              onClick={() => openQueryLibraryDrawer(activeDatasources, onSelectQueryFromLibrary)}
              icon="plus"
            >
              <Trans i18nKey="explore.secondary-actions.add-from-query-library">Add query from library</Trans>
            </ToolbarButton>
          )}
        </>
      )}
      <ToolbarButton
        variant={queryInspectorButtonActive ? 'active' : 'canvas'}
        aria-label={t('explore.secondary-actions.query-inspector-button-aria-label', 'Query inspector')}
        onClick={onClickQueryInspectorButton}
        icon="info-circle"
      >
        <Trans i18nKey="explore.secondary-actions.query-inspector-button">Query inspector</Trans>
      </ToolbarButton>
    </div>
  );
}
