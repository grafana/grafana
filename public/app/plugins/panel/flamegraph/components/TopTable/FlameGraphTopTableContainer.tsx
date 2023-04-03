import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { CoreApp, DataFrame, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

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
  setSelectedBarIndex: (bar: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  getLabelValue: (label: string | number) => string;
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
  getLabelValue,
}: Props) => {
  const styles = useStyles2(() => getStyles(selectedView, app));
  const theme = useTheme2();
  const [topTable, setTopTable] = useState<TopTableData[]>();
  const valueField =
    data.fields.find((f) => f.name === 'value') ?? data.fields.find((f) => f.type === FieldType.number);

  const selfField = data.fields.find((f) => f.name === 'self') ?? data.fields.find((f) => f.type === FieldType.number);
  const labelsField = data.fields.find((f) => f.name === 'label');

  const sortLevelsIntoTable = useCallback(() => {
    let label, self, value;
    let table: { [key: string]: TableData } = {};

    if (valueField && selfField && labelsField) {
      const valueValues = valueField.values;
      const selfValues = selfField.values;
      const labelValues = labelsField.values;

      for (let i = 0; i < valueValues.length; i++) {
        value = valueValues.get(i);
        self = selfValues.get(i);
        label = getLabelValue(labelValues.get(i));
        table[label] = table[label] || {};
        table[label].self = table[label].self ? table[label].self + self : self;
        table[label].total = table[label].total ? table[label].total + value : value;
      }
    }

    return table;
  }, [getLabelValue, selfField, valueField, labelsField]);

  const getTopTableData = useCallback(
    (field: Field, value: number) => {
      const processor = getDisplayProcessor({ field, theme });
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
    },
    [theme]
  );

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
  }, [data.fields, selfField, sortLevelsIntoTable, valueField, getTopTableData]);

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
