import { useEffect, useRef, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { type QueryResponse } from 'app/features/search/service/types';
import { useDispatch, useSelector } from 'app/types/store';

import { MAX_SELECT_ALL_ITEMS } from '../constants';
import { setItemSelectionState } from '../state/slice';
import { type BrowseDashboardsPermissions, type DashboardTreeSelection } from '../types';
import { areAllSelected, getSelectableItems } from '../utils/selectAll';

interface Props {
  result: QueryResponse;
  permissions: BrowseDashboardsPermissions;
}

/**
 * Once every loaded search result is selected, offers to select the results that haven't been
 * loaded yet, up to MAX_SELECT_ALL_ITEMS.
 */
export function SelectAllMatchingBanner({ result, permissions }: Props) {
  const dispatch = useDispatch();
  const selectedItems = useSelector((state) => state.browseDashboards.selectedItems);
  const [isLoading, setIsLoading] = useState(false);

  const latestResult = useRef(result);
  const isMounted = useRef(true);
  useEffect(() => {
    latestResult.current = result;
  }, [result]);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const { view, totalRows } = result;
  const target = Math.min(totalRows, MAX_SELECT_ALL_ITEMS);
  const isCapped = totalRows > MAX_SELECT_ALL_ITEMS;

  const onSelectAll = async () => {
    setIsLoading(true);
    try {
      await result.loadMoreItems(target - 1);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('browse-dashboards.select-all-matching.load-error', 'Failed to load all matching items'),
      ]);
      if (isMounted.current) {
        setIsLoading(false);
      }
      return;
    }

    // The query or filters changed while loading, so these rows are no longer what the user sees
    if (!isMounted.current || latestResult.current !== result) {
      return;
    }

    for (const item of getSelectableItems(result.view, permissions, target)) {
      if (!selectedItems[item.kind][item.uid]) {
        dispatch(setItemSelectionState({ item, isSelected: true }));
      }
    }
    setIsLoading(false);
  };

  const selectedCount = countSelected(selectedItems);
  const loadedItems = getSelectableItems(view, permissions);
  // Derived from the selection rather than local state, so it survives deselecting and reselecting
  const coversTarget =
    view.length >= target && areAllSelected(getSelectableItems(view, permissions, target), selectedItems);
  const canOfferSelectAll = !coversTarget && view.length < totalRows && areAllSelected(loadedItems, selectedItems);

  return (
    <>
      <Text weight="medium">
        {t('browse-dashboards.select-all-matching.selected-count', '', {
          count: selectedCount,
          defaultValue_one: '{{count}} item selected',
          defaultValue_other: '{{count}} items selected',
        })}
      </Text>
      {canOfferSelectAll && (
        <Button variant="secondary" disabled={isLoading} icon={isLoading ? 'spinner' : undefined} onClick={onSelectAll}>
          {isCapped
            ? t('browse-dashboards.select-all-matching.select-first', 'Select the first {{max}} of {{total}} items', {
                max: MAX_SELECT_ALL_ITEMS,
                total: totalRows,
              })
            : t('browse-dashboards.select-all-matching.select-all', '', {
                count: totalRows,
                defaultValue_one: 'Select the {{count}} item matching this search',
                defaultValue_other: 'Select all {{count}} items matching this search',
              })}
        </Button>
      )}
      {isCapped && coversTarget && (
        <Text color="secondary">
          {t(
            'browse-dashboards.select-all-matching.capped',
            'Only the first {{max}} of {{total}} items are selected.',
            { max: MAX_SELECT_ALL_ITEMS, total: totalRows }
          )}
        </Text>
      )}
    </>
  );
}

function countSelected(selectedItems: DashboardTreeSelection) {
  return (
    Object.values(selectedItems.dashboard).filter(Boolean).length +
    Object.values(selectedItems.folder).filter(Boolean).length
  );
}
