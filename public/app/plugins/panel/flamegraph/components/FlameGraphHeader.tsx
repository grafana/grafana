import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import useDebounce from 'react-use/lib/useDebounce';
import usePrevious from 'react-use/lib/usePrevious';

import { GrafanaTheme2, CoreApp } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Input, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { config } from '../../../../core/config';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import { SelectedView } from './types';

type Props = {
  app: CoreApp;
  search: string;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  setSearch: (search: string) => void;
  selectedView: SelectedView;
  setSelectedView: (view: SelectedView) => void;
  containerWidth: number;
};

const FlameGraphHeader = ({
  app,
  search,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMin,
  setRangeMax,
  setSearch,
  selectedView,
  setSelectedView,
  containerWidth,
}: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, app));

  let viewOptions: Array<{ value: SelectedView; label: string; description: string }> = [
    { value: SelectedView.TopTable, label: 'Top Table', description: 'Only show top table' },
    { value: SelectedView.FlameGraph, label: 'Flame Graph', description: 'Only show flame graph' },
  ];

  if (containerWidth >= MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH) {
    viewOptions.push({
      value: SelectedView.Both,
      label: 'Both',
      description: 'Show both the top table and flame graph',
    });
  }

  const onResetView = () => {
    setTopLevelIndex(0);
    setSelectedBarIndex(0);
    setRangeMin(0);
    setRangeMax(1);
    // We could set only one and wait them to sync but there is no need to debounce this.
    setSearch('');
    setLocalSearch('');
  };

  const [localSearch, setLocalSearch] = useSearchInput(search, setSearch);

  return (
    <div className={styles.header}>
      <div className={styles.leftContainer}>
        <div className={styles.inputContainer}>
          <Input
            value={localSearch || ''}
            onChange={(v) => {
              setLocalSearch(v.currentTarget.value);
            }}
            placeholder={'Search..'}
            width={44}
          />
        </div>
        <Button type={'button'} variant="secondary" onClick={onResetView}>
          Reset view
        </Button>
      </div>

      <div className={styles.rightContainer}>
        <RadioButtonGroup<SelectedView>
          options={viewOptions}
          value={selectedView}
          onChange={(view) => {
            reportInteraction('grafana_flamegraph_view_selected', {
              app,
              grafana_version: config.buildInfo.version,
              view,
            });
            setSelectedView(view);
          }}
        />
      </div>
    </div>
  );
};

function useSearchInput(
  search: string,
  setSearch: (search: string) => void
): [string | undefined, (search: string) => void] {
  const [localSearchState, setLocalSearchState] = useState(search);
  const prevSearch = usePrevious(search);

  // Debouncing cause changing parent search triggers rerender on both the flamegraph and table
  useDebounce(
    () => {
      setSearch(localSearchState);
    },
    250,
    [localSearchState]
  );

  // Make sure we still handle updates from parent (from clicking on a table item for example). We check if the parent
  // search value changed to something that isn't our local value.
  useEffect(() => {
    if (prevSearch !== search && search !== localSearchState) {
      setLocalSearchState(search);
    }
  }, [search, prevSearch, localSearchState]);

  return [localSearchState, setLocalSearchState];
}

const getStyles = (theme: GrafanaTheme2, app: CoreApp) => ({
  header: css`
    display: flow-root;
    width: 100%;
    background: ${theme.colors.background.primary};
    top: 0;
    height: 50px;
    z-index: ${theme.zIndex.navbarFixed};
    ${app === CoreApp.Explore ? 'position: sticky; margin-bottom: 8px; padding-top: 9px' : ''};
  `,
  inputContainer: css`
    float: left;
    margin-right: 20px;
  `,
  leftContainer: css`
    float: left;
  `,
  rightContainer: css`
    float: right;
  `,
});

export default FlameGraphHeader;
