import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, CoreApp } from '@grafana/data';
import { Button, Input, RadioButtonGroup, useStyles2 } from '@grafana/ui';

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

  return (
    <div className={styles.header}>
      <div className={styles.leftContainer}>
        <div className={styles.inputContainer}>
          <Input
            value={search || ''}
            onChange={(v) => {
              setSearch(v.currentTarget.value);
            }}
            placeholder={'Search..'}
            width={24}
          />
        </div>
        <Button
          type={'button'}
          variant={'secondary'}
          size={'md'}
          onClick={() => {
            setTopLevelIndex(0);
            setSelectedBarIndex(0);
            setRangeMin(0);
            setRangeMax(1);
            setSearch('');
          }}
        >
          Reset View
        </Button>
      </div>

      <div className={styles.rightContainer}>
        <RadioButtonGroup<SelectedView>
          options={viewOptions}
          value={selectedView}
          onChange={(view) => {
            setSelectedView(view);
          }}
        />
      </div>
    </div>
  );
};

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
