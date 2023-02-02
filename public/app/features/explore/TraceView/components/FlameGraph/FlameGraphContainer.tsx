import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { DataFrame, DataFrameView, CoreApp } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import FlameGraph from 'app/plugins/panel/flamegraph/components/FlameGraph/FlameGraph';
import { Item, nestedSetToLevels } from 'app/plugins/panel/flamegraph/components/FlameGraph/dataTransform';
import { SelectedView } from 'app/plugins/panel/flamegraph/components/types';
import { PIXELS_PER_LEVEL } from 'app/plugins/panel/flamegraph/constants';

type Props = {
  data: DataFrame;
  flameGraphHeight?: number;
};

const FlameGraphContainer = (props: Props) => {
  const [topLevelIndex, setTopLevelIndex] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState(0);
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);

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

  const styles = useStyles2(() => getStyles(CoreApp.Explore, PIXELS_PER_LEVEL * levels.length));

  useEffect(() => {
    setTopLevelIndex(0);
    setSelectedBarIndex(0);
    setRangeMin(0);
    setRangeMax(1);
  }, [props.data]);

  return (
    <div className={styles.container}>
      <FlameGraph
        data={props.data}
        app={CoreApp.Explore}
        flameGraphHeight={props.flameGraphHeight}
        levels={levels}
        topLevelIndex={topLevelIndex}
        selectedBarIndex={selectedBarIndex}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        search={''}
        setTopLevelIndex={setTopLevelIndex}
        setSelectedBarIndex={setSelectedBarIndex}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        selectedView={SelectedView.FlameGraph}
      />
    </div>
  );
};

const getStyles = (app: CoreApp, height: number) => ({
  container: css`
    height: ${app === CoreApp.Explore ? height + 'px' : '100%'};
  `,
});

export default FlameGraphContainer;
