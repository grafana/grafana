import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, DataFrameView, CoreApp } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH, PIXELS_PER_LEVEL } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView } from './types';

type Props = {
  data: DataFrame;
  app: CoreApp;
  // Height for flame graph when not used in explore.
  // This needs to be different to explore flame graph height as we
  // use panels with user adjustable heights in dashboards etc.
  flameGraphHeight?: number;
};

const FlameGraphContainer = (props: Props) => {
  const [topLevelIndex, setTopLevelIndex] = useState(0);
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

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

  return (
    <div ref={sizeRef} className={styles.container}>
      <FlameGraphHeader
        app={props.app}
        setTopLevelIndex={setTopLevelIndex}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        search={search}
        setSearch={setSearch}
        selectedView={selectedView}
        setSelectedView={setSelectedView}
        containerWidth={containerWidth}
      />

      {selectedView !== SelectedView.FlameGraph && (
        <FlameGraphTopTableContainer
          data={props.data}
          app={props.app}
          totalLevels={levels.length}
          selectedView={selectedView}
          search={search}
          setSearch={setSearch}
          setTopLevelIndex={setTopLevelIndex}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
        />
      )}

      {selectedView !== SelectedView.TopTable && (
        <FlameGraph
          data={props.data}
          app={props.app}
          flameGraphHeight={props.flameGraphHeight}
          levels={levels}
          topLevelIndex={topLevelIndex}
          rangeMin={rangeMin}
          rangeMax={rangeMax}
          search={search}
          setTopLevelIndex={setTopLevelIndex}
          setRangeMin={setRangeMin}
          setRangeMax={setRangeMax}
          selectedView={selectedView}
        />
      )}
    </div>
  );
};

const getStyles = (app: CoreApp, height: number) => ({
  container: css`
    height: ${app === CoreApp.Explore ? height + 'px' : '100%'};
  `,
});

export default FlameGraphContainer;
