import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, CoreApp, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH, PIXELS_PER_LEVEL } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { FlameGraphDataContainer, LevelItem, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView } from './types';

type Props = {
  data?: DataFrame;
  app: CoreApp;
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

  const [dataContainer, levels] = useMemo((): [FlameGraphDataContainer, LevelItem[][]] | [undefined, undefined] => {
    if (!props.data) {
      return [undefined, undefined];
    }
    const container = new FlameGraphDataContainer(props.data, theme);

    // Transform dataFrame with nested set format to array of levels. Each level contains all the bars for a particular
    // level of the flame graph. We do this temporary as in the end we should be able to render directly by iterating
    // over the dataFrame rows.
    return [container, nestedSetToLevels(container)];
  }, [props.data, theme]);

  const styles = useStyles2(getStyles);

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

  const height = props.app === CoreApp.Explore ? PIXELS_PER_LEVEL * (levels?.length ?? 0) : undefined;

  return (
    <>
      {dataContainer && (
        <div ref={sizeRef} className={styles.container} style={{ height }}>
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

          <div className={styles.body}>
            {selectedView !== SelectedView.FlameGraph && (
              <FlameGraphTopTableContainer
                data={dataContainer}
                app={props.app}
                totalLevels={levels.length}
                selectedView={selectedView}
                search={search}
                setSearch={setSearch}
                setTopLevelIndex={setTopLevelIndex}
                setSelectedBarIndex={setSelectedBarIndex}
                setRangeMin={setRangeMin}
                setRangeMax={setRangeMax}
              />
            )}

            {selectedView !== SelectedView.TopTable && (
              <FlameGraph
                data={dataContainer}
                app={props.app}
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
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      minHeight: 0,
      gap: theme.spacing(2),
    }),
    body: css({
      display: 'flex',
      flexGrow: 1,
      minHeight: 0,
    }),
  };
}

export default FlameGraphContainer;
