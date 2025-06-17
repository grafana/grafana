import { FormEvent, useMemo, useState } from 'react';

import { DataFrame, SelectableValue, standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';
import { TransformationPickerNg } from 'app/features/dashboard/components/TransformationsEditor/TransformationPickerNg';
import {
  FilterCategory,
  VIEW_ALL_VALUE,
} from 'app/features/dashboard/components/TransformationsEditor/TransformationsEditor';

interface DrawerState {
  search: string;
  showIllustrations: boolean;
  showCompactView?: boolean;
  selectedFilter?: FilterCategory;
}

interface TransformationsDrawerProps {
  series: DataFrame[];
  isOpen: boolean;
  onClose: () => void;
  onTransformationAdd: (selectedItem: SelectableValue<string>) => void;
}

export function TransformationsDrawer(props: TransformationsDrawerProps) {
  const { isOpen, series, onClose, onTransformationAdd } = props;

  const [drawerState, setDrawerState] = useState<DrawerState>({
    search: '',
    showIllustrations: true,
    showCompactView: false,
  });

  const onSearchChange = (e: FormEvent<HTMLInputElement>) =>
    setDrawerState({ ...drawerState, ...{ search: e.currentTarget.value } });

  const onShowIllustrationsChange = (showIllustrations: boolean): void =>
    setDrawerState({ ...drawerState, ...{ showIllustrations } });

  const onShowCompactViewChange = (showCompactView: boolean): void =>
    setDrawerState({ ...drawerState, ...{ showCompactView } });

  const onSelectedFilterChange = (selectedFilter: FilterCategory): void =>
    setDrawerState({ ...drawerState, ...{ selectedFilter } });

  const allTransformations = useMemo(
    () => standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0)),
    []
  );

  const transformations = allTransformations.filter((t) => {
    if (
      drawerState.selectedFilter &&
      drawerState.selectedFilter !== VIEW_ALL_VALUE &&
      !t.categories?.has(drawerState.selectedFilter)
    ) {
      return false;
    }
    return (
      t.name.toLocaleLowerCase().includes(drawerState.search.toLocaleLowerCase()) ||
      t.description?.toLocaleLowerCase().includes(drawerState.search.toLocaleLowerCase())
    );
  });

  const searchBoxSuffix = (
    <>
      {transformations.length} / {allTransformations.length} &nbsp;&nbsp;
      <IconButton
        name="times"
        onClick={() => {
          setDrawerState({ ...drawerState, ...{ search: '' } });
        }}
        tooltip={t('dashboard-scene.transformations-drawer.search-box-suffix.tooltip-clear-search', 'Clear search')}
      />
    </>
  );

  if (!isOpen) {
    return;
  }

  return (
    <TransformationPickerNg
      data={series}
      onTransformationAdd={onTransformationAdd}
      xforms={transformations}
      search={drawerState.search}
      noTransforms={false}
      suffix={drawerState.search !== '' ? searchBoxSuffix : <></>}
      selectedFilter={drawerState.selectedFilter}
      onSearchChange={onSearchChange}
      onSearchKeyDown={() => {}}
      showIllustrations={drawerState.showIllustrations}
      showCompactView={drawerState.showCompactView}
      onShowIllustrationsChange={onShowIllustrationsChange}
      onShowCompactViewChange={onShowCompactViewChange}
      onSelectedFilterChange={onSelectedFilterChange}
      onClose={onClose}
    />
  );
}
