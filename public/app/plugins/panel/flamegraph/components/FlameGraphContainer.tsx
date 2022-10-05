import React, { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, DataFrameView } from '@grafana/data';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView } from './types';

type Props = {
  data: DataFrame;
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
    <div ref={sizeRef}>
      <FlameGraphHeader
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

export default FlameGraphContainer;
