import type { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';
import { type FavoriteDatasources, reportInteraction } from '@grafana/runtime';

import { DataSourceCard } from './DataSourceCard';
import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './DataSourcePicker';
import { isDataSourceMatch } from './utils';

export type DataSourceCardItemProps = {
  ds: DataSourceInstanceSettings;
  isSelected: boolean;
  enableKeyboardNavigation?: boolean;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  favoriteDataSources: FavoriteDatasources;
  onChange: (ds: DataSourceInstanceSettings) => void;
  pushRecentlyUsedDataSource: (ds: DataSourceInstanceSettings) => void;
};

export function DataSourceCardItem({
  ds,
  isSelected,
  enableKeyboardNavigation,
  current,
  favoriteDataSources,
  onChange,
  pushRecentlyUsedDataSource,
}: DataSourceCardItemProps) {
  return (
    <DataSourceCard
      data-testid="data-source-card"
      {...(enableKeyboardNavigation && {
        'data-role': 'keyboardSelectableItem',
        'data-selecteditem': isSelected ? 'true' : 'false',
      })}
      ds={ds}
      onClick={() => {
        pushRecentlyUsedDataSource(ds);
        onChange(ds);
      }}
      selected={isDataSourceMatch(ds, current)}
      isFavorite={favoriteDataSources.enabled ? favoriteDataSources.isFavoriteDatasource(ds.uid) : undefined}
      onToggleFavorite={
        favoriteDataSources.enabled
          ? () => {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.TOGGLE_FAVORITE,
                ds_type: ds.type,
                is_favorite: !favoriteDataSources.isFavoriteDatasource(ds.uid),
              });
              favoriteDataSources.isFavoriteDatasource(ds.uid)
                ? favoriteDataSources.removeFavoriteDatasource(ds)
                : favoriteDataSources.addFavoriteDatasource(ds);
            }
          : undefined
      }
    />
  );
}
