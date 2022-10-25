import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { CoreApp, createTheme, DataFrame, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../../constants';
import { SampleUnit, SelectedView, TableData, TopTableData } from '../types';

import FlameGraphTopTable from './FlameGraphTopTable';

type Props = {
  data: DataFrame;
  app: CoreApp;
  totalLevels: number;
  selectedView: SelectedView;
  search: string;
  setSearch: (search: string) => void;
  setTopLevelIndex: (level: number) => void;
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
  setRangeMin,
  setRangeMax,
}: Props) => {
  const styles = useStyles2(() => getStyles(selectedView, app));
  const [topTable, setTopTable] = useState<TopTableData[]>();
  const valueField =
    data.fields.find((f) => f.name === 'value') ?? data.fields.find((f) => f.type === FieldType.number);
  const selfField = data.fields.find((f) => f.name === 'self') ?? data.fields.find((f) => f.type === FieldType.number);

  const sortLevelsIntoTable = useCallback(() => {
    let label, self, value;
    let table: { [key: string]: TableData } = {};

    if (data.fields.length === 4) {
      const valueValues = data.fields[1].values;
      const selfValues = data.fields[2].values;
      const labelValues = data.fields[3].values;

      for (let i = 0; i < valueValues.length; i++) {
        value = valueValues.get(i);
        self = selfValues.get(i);
        label = labelValues.get(i);
        table[label] = table[label] || {};
        table[label].self = table[label].self ? table[label].self + self : self;
        table[label].total = table[label].total ? table[label].total + value : value;
      }
    }

    return table;
  }, [data.fields]);

  const getTopTableData = (field: Field, value: number) => {
    const processor = getDisplayProcessor({ field, theme: createTheme() /* theme does not matter for us here */ });
    const displayValue = processor(value);
    let unitValue = displayValue.text + displayValue.suffix;

    switch (field.config.unit) {
      case SampleUnit.Bytes:
        break;
      case SampleUnit.Nanoseconds:
        break;
      default:
        if (!displayValue.suffix) {
          // Makes sure we don't show 123undefined or something like that if suffix isn't defined
          unitValue = displayValue.text;
        }
        break;
    }

    return unitValue;
  };

  useEffect(() => {
    const table = sortLevelsIntoTable();

    let topTable: TopTableData[] = [];
    for (let key in table) {
      const selfUnit = getTopTableData(selfField!, table[key].self);
      const valueUnit = getTopTableData(valueField!, table[key].total);

      topTable.push({
        symbol: key,
        self: { value: table[key].self, unitValue: selfUnit },
        total: { value: table[key].total, unitValue: valueUnit },
      });
    }

    setTopTable(topTable);
  }, [data.fields, selfField, sortLevelsIntoTable, valueField]);

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

const getStyles = (selectedView: SelectedView, app: CoreApp) => {
  const marginRight = '20px';

  return {
    topTableContainer: css`
      cursor: pointer;
      float: left;
      margin-right: ${marginRight};
      width: ${selectedView === SelectedView.TopTable ? '100%' : `calc(50% - ${marginRight})`};
      ${app !== CoreApp.Explore ? 'height: calc(100% - 44px)' : ''}; // 44px to adjust for header pushing content down
    `,
  };
};

export default FlameGraphTopTableContainer;
