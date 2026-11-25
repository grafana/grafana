import { useEffect, useRef, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { type QueryResponse } from 'app/features/search/service/types';
import { useDispatch, useSelector } from 'app/types/store';

import { MAX_SELECT_ALL_ITEMS } from '../constants';
import { setAllSelection, setItemSelectionState } from '../state/slice';
import { type BrowseDashboardsPermissions } from '../types';
import { areAllSelected, getSelectableItems } from '../utils/selectAll';

interface Props {
  result: QueryResponse;
  permissions: BrowseDashboardsPermissions;
}

/**
 * Like Gmail's "Select all conversations": once every loaded search result is selected, offers to
 * select the results that haven't been loaded yet, up to MAX_SELECT_ALL_ITEMS.
 */
export function SelectAllMatchingBanner({ result, permissions }: Props) {
  const dispatch = useDispatch();
  const selectedItems = useSelector((state) => state.browseDashboards.selectedItems);
  const [isLoading, setIsLoading] = useState(false);
  const [extendedResult, setExtendedResult] = useState<QueryResponse>();

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

  const clearSelection = () => dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

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
    setExtendedResult(result);
    setIsLoading(false);
  };

  if (extendedResult === result && !(isCapped && view.length > target)) {
    if (!areAllSelected(getSelectableItems(view, permissions, target), selectedItems)) {
      return null;
    }

    return (
      <BannerRow>
        <Text>
          {isCapped
            ? t(
                'browse-dashboards.select-all-matching.capped',
                'The first {{max}} of {{total}} items are selected. Delete or move them and repeat for the rest, or scroll to load everything before selecting.',
                { max: MAX_SELECT_ALL_ITEMS, total: totalRows }
              )
            : t('browse-dashboards.select-all-matching.all-selected', '', {
                count: totalRows,
                defaultValue_one: 'The {{count}} item matching this search is selected.',
                defaultValue_other: 'All {{count}} items matching this search are selected.',
              })}
        </Text>
        <Button variant="primary" fill="text" size="sm" onClick={clearSelection}>
          {t('browse-dashboards.select-all-matching.clear', 'Clear selection')}
        </Button>
      </BannerRow>
    );
  }

  const loadedItems = getSelectableItems(view, permissions);
  if (view.length >= totalRows || !areAllSelected(loadedItems, selectedItems)) {
    return null;
  }

  return (
    <BannerRow>
      <Text>
        {t('browse-dashboards.select-all-matching.page-selected', '', {
          count: loadedItems.length,
          defaultValue_one: '{{count}} item on this page is selected.',
          defaultValue_other: '{{count}} items on this page are selected.',
        })}
      </Text>
      <Button
        variant="primary"
        fill="text"
        size="sm"
        disabled={isLoading}
        icon={isLoading ? 'spinner' : undefined}
        onClick={onSelectAll}
      >
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
    </BannerRow>
  );
}

function BannerRow({ children }: { children: React.ReactNode }) {
  return (
    <Stack justifyContent="center" alignItems="center" gap={1} wrap="wrap">
      {children}
    </Stack>
  );
}
