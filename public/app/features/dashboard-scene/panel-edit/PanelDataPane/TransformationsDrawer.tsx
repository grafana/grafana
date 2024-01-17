import React, { FormEvent, useCallback, useMemo, useState } from 'react';

import { DataFrame, SelectableValue, standardTransformersRegistry } from '@grafana/data';
import { TransformationPickerNg } from 'app/features/dashboard/components/TransformationsEditor/TransformationPickerNg';
import { FilterCategory } from 'app/features/dashboard/components/TransformationsEditor/TransformationsEditor';

interface DrawerState {
  search: string;
  showIllustrations: boolean;
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
  });

  const onSearchChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => setDrawerState({ ...drawerState, ...{ search: e.currentTarget.value } }),
    [drawerState]
  );

  const onShowIllustrationsChange = useCallback(
    (showIllustrations: boolean): void => setDrawerState({ ...drawerState, ...{ showIllustrations } }),
    [drawerState]
  );
  const onSelectedFilterChange = useCallback(
    (selectedFilter: FilterCategory): void => setDrawerState({ ...drawerState, ...{ selectedFilter } }),
    [drawerState]
  );

  const allTransformations = useMemo(
    () => standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0)),
    []
  );

  const transformations = useMemo(
    () =>
      allTransformations.filter((t) => {
        if (
          drawerState.selectedFilter &&
          drawerState.selectedFilter !== 'viewAll' &&
          !t.categories?.has(drawerState.selectedFilter)
        ) {
          return false;
        }
        return t.name.toLocaleLowerCase().includes(drawerState.search.toLocaleLowerCase());
      }),
    [drawerState, allTransformations]
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
      suffix={<></>}
      selectedFilter={drawerState.selectedFilter}
      onSearchChange={onSearchChange}
      onSearchKeyDown={() => {}}
      showIllustrations={drawerState.showIllustrations}
      onShowIllustrationsChange={onShowIllustrationsChange}
      onSelectedFilterChange={onSelectedFilterChange}
      onClose={onClose}
    />
  );
}
