import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, DataFrameView, CoreApp, DataSourceApi } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
import { PIXELS_PER_LEVEL } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import { GloblDataRanges, SourceCodeView } from './SourceCodeView';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';

type Props = {
  data?: DataFrame;
  app: CoreApp;
  datasource?: DataSourceApi | null;
  // Height for flame graph when not used in explore.
  // This needs to be different to explore flame graph height as we
  // use panels with user adjustable heights in dashboards etc.
  flameGraphHeight?: number;
};

const FlameGraphContainer = (props: Props) => {
  const [topLevelIndex, setTopLevelIndex] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState(0);
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');

  const [codeVisible, setCodeVisible] = useState(false);
  const [graphVisible, setGraphVisible] = useState(true);
  const [tableVisible, setTableVisible] = useState(true);

  useEffect(() => {
    if (!(codeVisible || graphVisible || tableVisible)) {
      // Make sure we always have something visible
      setGraphVisible(true);
    }
  }, [codeVisible, graphVisible, tableVisible]);

  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  // State for the selected filename/func/line
  const [selectedLocation, setSelectedLocation] = useState<number>();
  const [selectedFileName, setSelectedFileName] = useState<string>();

  const labelField = props.data?.fields.find((f) => f.name === 'label');
  const fileNameField = props.data?.fields.find((f) => f.name === 'fileName');

  // Label can actually be an enum field so depending on that we have to access it through display processor. This is
  // both a backward compatibility but also to allow using a simple dataFrame without enum config. This would allow
  // users to use this panel with correct query from data sources that do not return profiles natively....Leon: this should just be a transformation then and not handled here?
  const getLabelValue = useCallback(
    (label: string | number) => {
      if (typeof label === 'string') {
        return label;
      }
      const enumConfig = labelField?.config?.type?.enum;
      if (enumConfig) {
        return enumConfig.text![label];
      } else {
        return label.toString();
      }
    },
    [labelField]
  );

  const getFileNameValue = useCallback(
    (label: string | number) => {
      if (typeof label === 'string') {
        return label;
      }
      const enumConfig = fileNameField?.config?.type?.enum;
      if (enumConfig) {
        return enumConfig.text![label];
      } else {
        return label.toString();
      }
    },
    [fileNameField]
  );

  // Transform dataFrame with nested set format to array of levels. Each level contains all the bars for a particular
  // level of the flame graph. We do this temporary as in the end we should be able to render directly by iterating
  // over the dataFrame rows.
  const levels = useMemo(() => {
    if (!props.data) {
      return [];
    }
    const dataView = new DataFrameView<Item>(props.data);

    return nestedSetToLevels(dataView);
  }, [props.data]);

  const styles = useStyles2(() => getStyles(props.app, PIXELS_PER_LEVEL * levels.length));

  // If user resizes window with both as the selected view
  // useEffect(() => {
  //   if (
  //     containerWidth > 0 &&
  //     containerWidth < MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH &&
  //     selectedView === SelectedView.Both
  //   ) {
  //     setSelectedView(SelectedView.FlameGraph);
  //   }
  // }, [selectedView, setSelectedView, containerWidth]);

  useEffect(() => {
    setTopLevelIndex(0);
    setSelectedBarIndex(0);
    setRangeMin(0);
    setRangeMax(1);
    setSelectedLocation(undefined);
  }, [props.data]);

  const globalDataRanges = useMemo<GloblDataRanges>(() => {
    let valuesFieldData = props.data?.fields.find((f) => f.name === 'value')?.values.toArray()!;
    let selfFieldData = props.data?.fields.find((f) => f.name === 'self')?.values.toArray()!;

    // to make sure we use the full color scale, we exclude the root total which
    // will eat up most of the high color range, since next size blocks are typically 30% or less
    // so we treat the next highest as the deepest red and everything else is relative to it
    let valuesFieldData2 = valuesFieldData.slice(1);
    let selfFieldData2 = selfFieldData.slice(1);

    let dataLen = props.data!.length;

    if (dataLen < 65e3) {
      return {
        value: [Math.min(...valuesFieldData2), Math.max(...valuesFieldData2)],
        self: [Math.min(...selfFieldData2), Math.max(...selfFieldData2)],
      };
    }

    return {
      value: [
        valuesFieldData2.reduce((acc, val) => (val < acc ? val : acc), Infinity),
        valuesFieldData2.reduce((acc, val) => (val > acc ? val : acc), 0),
      ],
      self: [
        selfFieldData2.reduce((acc, val) => (val < acc ? val : acc), Infinity),
        selfFieldData2.reduce((acc, val) => (val > acc ? val : acc), 0),
      ],
    };
  }, [props.data]);

  return (
    <>
      {props.data && (
        <div ref={sizeRef} className={styles.container}>
          <FlameGraphHeader
            app={props.app}
            setTopLevelIndex={setTopLevelIndex}
            setSelectedBarIndex={setSelectedBarIndex}
            setRangeMin={setRangeMin}
            setRangeMax={setRangeMax}
            search={search}
            setSearch={setSearch}
            containerWidth={containerWidth}
            codeVisible={codeVisible}
            graphVisible={graphVisible}
            tableVisible={tableVisible}
            toggleGraphVisible={() => setGraphVisible(!graphVisible)}
            toggleTableVisible={() => setTableVisible(!tableVisible)}
            toggleCodeVisible={() => setCodeVisible(!codeVisible)}
          />

          <div className={styles.panes}>
            {tableVisible && (
              <div className={styles.pane}>
                <FlameGraphTopTableContainer
                  data={props.data}
                  search={search}
                  setSearch={setSearch}
                  setTopLevelIndex={setTopLevelIndex}
                  setSelectedBarIndex={setSelectedBarIndex}
                  setRangeMin={setRangeMin}
                  setRangeMax={setRangeMax}
                  getLabelValue={getLabelValue}
                  getFileNameValue={getFileNameValue}
                  onSelectFilename={(name: string) => {
                    setSelectedFileName(name);
                    setSelectedLocation(undefined);
                    setCodeVisible(true);
                    setGraphVisible(false);
                  }}
                />
              </div>
            )}

            {graphVisible && (
              <div className={styles.pane}>
                <FlameGraph
                  data={props.data}
                  app={props.app}
                  flameGraphHeight={props.flameGraphHeight}
                  levels={levels}
                  topLevelIndex={topLevelIndex}
                  selectedBarIndex={selectedBarIndex}
                  rangeMin={rangeMin}
                  rangeMax={rangeMax}
                  search={search}
                  setTopLevelIndex={setTopLevelIndex}
                  setSelectedBarIndex={setSelectedBarIndex}
                  setRangeMin={setRangeMin}
                  setRangeMax={setRangeMax}
                  getLabelValue={getLabelValue}
                  setSelectedLocation={(location) => {
                    setSelectedLocation(location);
                    setSelectedFileName(undefined);
                    setCodeVisible(true);
                    setTableVisible(false);
                  }}
                />
              </div>
            )}

            {codeVisible && (
              <div className={styles.pane} style={{ paddingTop: '38px' }}>
                {selectedLocation || selectedFileName ? (
                  <SourceCodeView
                    locationIdx={selectedLocation}
                    fileName={selectedFileName}
                    getLabelValue={getLabelValue}
                    datasource={props.datasource! as PhlareDataSource}
                    data={props.data}
                    globalDataRanges={globalDataRanges}
                  />
                ) : (
                  <div>No code to show</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const getStyles = (app: CoreApp, height: number) => ({
  container: css`
    height: 100%;
  `,

  panes: css`
    display: flex;
  `,

  pane: css`
    flex: 1;
    min-width: 0;
  `,
});

export default FlameGraphContainer;
