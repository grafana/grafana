import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { CoreApp, DisplayValue } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../../constants';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { SelectedView, TableData, TopTableData } from '../types';

import FlameGraphTopTable from './FlameGraphTopTable';

type Props = {
  data: FlameGraphDataContainer;
  app: CoreApp;
  totalLevels: number;
  selectedView: SelectedView;
  search: string;
  setSearch: (search: string) => void;
  setTopLevelIndex: (level: number) => void;
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

const FlameGraphTopTableContainer = ({
  data,
  app,
  totalLevels,
  selectedView,
  search,
  setSearch,
  setTopLevelIndex,
  setSelectedBarIndex,
  setRangeMin,
  setRangeMax,
}: Props) => {
  const styles = useStyles2(() => getStyles(selectedView, app));

  const topTable = useMemo(() => {
    // Group the data by label
    // TODO: should be by filename + funcName + linenumber?
    let table: { [key: string]: TableData } = {};
    for (let i = 0; i < data.data.length; i++) {
      const value = data.getValue(i);
      const self = data.getSelf(i);
      const label = data.getLabel(i);
      table[label] = table[label] || {};
      table[label].self = table[label].self ? table[label].self + self : self;
      table[label].total = table[label].total ? table[label].total + value : value;
    }

    let topTable: TopTableData[] = [];
    for (let key in table) {
      const selfUnit = handleUnits(data.valueDisplayProcessor(table[key].self), data.getUnitTitle());
      const valueUnit = handleUnits(data.valueDisplayProcessor(table[key].total), data.getUnitTitle());

      topTable.push({
        symbol: key,
        self: { value: table[key].self, unitValue: selfUnit },
        total: { value: table[key].total, unitValue: valueUnit },
      });
    }

    return topTable;
  }, [data]);

  return (
    <>
      {topTable && (
        <div className={styles.topTableContainer}>
          <AutoSizer style={{ width: '100%', height: PIXELS_PER_LEVEL * totalLevels + 'px' }}>
            {({ width, height }) => (
              <FlameGraphTopTable
                width={width}
                height={height}
                data={topTable}
                search={search}
                setSearch={setSearch}
                setTopLevelIndex={setTopLevelIndex}
                setSelectedBarIndex={setSelectedBarIndex}
                setRangeMin={setRangeMin}
                setRangeMax={setRangeMax}
              />
            )}
          </AutoSizer>
        </div>
      )}
    </>
  );
};

function handleUnits(displayValue: DisplayValue, unit: string) {
  let unitValue = displayValue.text + displayValue.suffix;
  if (unit === 'Count') {
    if (!displayValue.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitValue = displayValue.text;
    }
  }
  return unitValue;
}

const getStyles = (selectedView: SelectedView, app: CoreApp) => {
  const marginRight = '20px';

  return {
    topTableContainer: css`
      cursor: pointer;
      float: left;
      margin-right: ${marginRight};
      width: ${selectedView === SelectedView.TopTable ? '100%' : `calc(50% - ${marginRight})`};
      ${app !== CoreApp.Explore
        ? 'height: calc(100% - 50px)'
        : 'height: calc(100% + 50px)'}; // 50px to adjust for header pushing content down
    `,
  };
};

export default FlameGraphTopTableContainer;
