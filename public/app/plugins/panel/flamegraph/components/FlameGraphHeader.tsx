import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import useDebounce from 'react-use/lib/useDebounce';
import usePrevious from 'react-use/lib/usePrevious';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Input, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { config } from '../../../../core/config';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import { SelectedView, TextAlign } from './types';

type Props = {
  app: CoreApp;
  search: string;
  setSearch: (search: string) => void;
  selectedView: SelectedView;
  setSelectedView: (view: SelectedView) => void;
  containerWidth: number;
  onReset: () => void;
  textAlign: TextAlign;
  onTextAlignChange: (align: TextAlign) => void;
};

const FlameGraphHeader = ({
  app,
  search,
  setSearch,
  selectedView,
  setSelectedView,
  containerWidth,
  onReset,
  textAlign,
  onTextAlignChange,
}: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, app));
  function interaction(name: string, context: Record<string, string | number>) {
    reportInteraction(`grafana_flamegraph_${name}`, {
      app,
      grafana_version: config.buildInfo.version,
      ...context,
    });
  }

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
        <Button
          type={'button'}
          variant="secondary"
          onClick={() => {
            onReset();
            // We could set only one and wait them to sync but there is no need to debounce this.
            setSearch('');
            setLocalSearch('');
          }}
        >
          Reset view
        </Button>
      </div>

      <div className={styles.rightContainer}>
        <RadioButtonGroup<TextAlign>
          size="sm"
          disabled={selectedView === SelectedView.TopTable}
          options={alignOptions}
          value={textAlign}
          onChange={(val) => {
            interaction('text_align_selected', { align: val });
            onTextAlignChange(val);
          }}
          className={styles.buttonSpacing}
        />
        <RadioButtonGroup<SelectedView>
          size="sm"
          options={getViewOptions(containerWidth)}
          value={selectedView}
          onChange={(view) => {
            interaction('view_selected', { view });
            setSelectedView(view);
          }}
        />
      </div>
    </div>
  );
};

const alignOptions: Array<SelectableValue<TextAlign>> = [
  { value: 'left', description: 'Align text left', icon: 'align-left' },
  { value: 'right', description: 'Align text right', icon: 'align-right' },
];

function getViewOptions(width: number): Array<SelectableValue<SelectedView>> {
  let viewOptions: Array<{ value: SelectedView; label: string; description: string }> = [
    { value: SelectedView.TopTable, label: 'Top Table', description: 'Only show top table' },
    { value: SelectedView.FlameGraph, label: 'Flame Graph', description: 'Only show flame graph' },
  ];

  if (width >= MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH) {
    viewOptions.push({
      value: SelectedView.Both,
      label: 'Both',
      description: 'Show both the top table and flame graph',
    });
  }

  return viewOptions;
}

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
    z-index: ${theme.zIndex.navbarFixed};
    ${app === CoreApp.Explore
      ? css`
          position: sticky;
          padding-bottom: ${theme.spacing(1)};
          padding-top: ${theme.spacing(1)};
        `
      : ''};
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
  buttonSpacing: css`
    margin-right: ${theme.spacing(1)};
  `,
});

export default FlameGraphHeader;
