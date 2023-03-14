import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, DataFrameView, CoreApp, getEnumDisplayProcessor, DataSourceApi } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { PhlareDataSource } from '../../../datasource/phlare/datasource';
import { CodeLocation } from '../../../datasource/phlare/types';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH, PIXELS_PER_LEVEL } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import { SourceCodeView } from './SourceCodeView';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView } from './types';

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
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const theme = useTheme2();

  // State for the selected filename/func/line
  const [selectedLocation, setSelectedLocation] = useState<CodeLocation>();

  const labelField = props.data?.fields.find((f) => f.name === 'label');
  const fileNameField = props.data?.fields.find((f) => f.name === 'fileName');

  // Label can actually be an enum field so depending on that we have to access it through display processor. This is
  // both a backward compatibility but also to allow using a simple dataFrame without enum config. This would allow
  // users to use this panel with correct query from data sources that do not return profiles natively.
  const getLabelValue = useCallback(
    (label: string | number) => {
      const enumConfig = labelField?.config?.type?.enum;
      if (enumConfig) {
        return getEnumDisplayProcessor(theme, enumConfig)(label).text;
      } else {
        return label.toString();
      }
    },
    [labelField, theme]
  );

  const getFileNameValue = useCallback(
    (label: string | number) => {
      const enumConfig = fileNameField?.config?.type?.enum;
      if (enumConfig) {
        return getEnumDisplayProcessor(theme, enumConfig)(label).text;
      } else {
        return label.toString();
      }
    },
    [fileNameField, theme]
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
  useEffect(() => {
    if (
      containerWidth > 0 &&
      containerWidth < MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH &&
      selectedView === SelectedView.Both
    ) {
      setSelectedView(SelectedView.FlameGraph);
    }
  }, [selectedView, setSelectedView, containerWidth]);

  useEffect(() => {
    setTopLevelIndex(0);
    setSelectedBarIndex(0);
    setRangeMin(0);
    setRangeMax(1);
  }, [props.data]);

  const fileProfile: Record<number, Item> = {};
  const view = new DataFrameView<Item>(props.data!);
  if (selectedLocation) {
    for (let i = 0; i < view.length; i++) {
      const item = view.get(i);
      if (item.fileName === selectedLocation.fileName) {
        fileProfile[item.line] = item;
      }
    }
  }

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
            selectedView={selectedView}
            setSelectedView={setSelectedView}
            containerWidth={containerWidth}
          />

          {selectedView !== SelectedView.FlameGraph && !selectedLocation && (
            <FlameGraphTopTableContainer
              data={props.data}
              app={props.app}
              totalLevels={levels.length}
              selectedView={selectedView}
              search={search}
              setSearch={setSearch}
              setTopLevelIndex={setTopLevelIndex}
              setSelectedBarIndex={setSelectedBarIndex}
              setRangeMin={setRangeMin}
              setRangeMax={setRangeMax}
              getLabelValue={getLabelValue}
            />
          )}

          {selectedView !== SelectedView.TopTable && (
            <FlameGraph
              className={SelectedView.Both || selectedLocation ? styles.flameGraphHalf : styles.flameGraphFull}
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
              selectedView={selectedView}
              getLabelValue={getLabelValue}
              setSelectedLocation={(index: number) => {
                const view = new DataFrameView<Item>(props.data!);
                const row = view.get(index);
                setSelectedLocation({
                  fileName: row.fileName,
                  func: row.label,
                  line: row.line,
                });
              }}
            />
          )}

          {selectedLocation && (
            <SourceCodeView
              location={selectedLocation}
              datasource={props.datasource! as PhlareDataSource}
              getLabelValue={getLabelValue}
              getFileNameValue={getFileNameValue}
              fileProfile={fileProfile}
            />
          )}
        </div>
      )}
    </>
  );
};

const getStyles = (app: CoreApp, height: number) => ({
  container: css`
    height: ${app === CoreApp.Explore ? height + 'px' : '100%'};
  `,

  flameGraphFull: css`
    width: 100%;
  `,

  flameGraphHalf: css`
    width: 50%;
  `,

  code: css`
    width: 50%;
    float: left;
  `,
});

export default FlameGraphContainer;
