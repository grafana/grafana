import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, CoreApp, GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { FlameGraphDataContainer, LevelItem, nestedSetToLevels } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { SelectedView, TextAlign } from './types';

type Props = {
  data?: DataFrame;
  app: CoreApp;
};

const FlameGraphContainer = (props: Props) => {
  const [focusedItemIndex, setFocusedItemIndex] = useState<number>();

  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [textAlign, setTextAlign] = useState<TextAlign>('left');

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
    setFocusedItemIndex(undefined);
    setRangeMin(0);
    setRangeMax(1);
  }, [props.data]);

  return (
    <>
      {dataContainer && (
        <div ref={sizeRef} className={styles.container}>
          <FlameGraphHeader
            app={props.app}
            search={search}
            setSearch={setSearch}
            selectedView={selectedView}
            setSelectedView={setSelectedView}
            containerWidth={containerWidth}
            onReset={() => {
              setRangeMin(0);
              setRangeMax(1);
              setFocusedItemIndex(undefined);
            }}
            textAlign={textAlign}
            onTextAlignChange={setTextAlign}
          />

          <div className={styles.body}>
            {selectedView !== SelectedView.FlameGraph && (
              <FlameGraphTopTableContainer
                data={dataContainer}
                app={props.app}
                totalLevels={levels.length}
                onSymbolClick={(symbol) => {
                  if (search === symbol) {
                    setSearch('');
                  } else {
                    reportInteraction('grafana_flamegraph_table_item_selected', {
                      app: props.app,
                      grafana_version: config.buildInfo.version,
                    });
                    setSearch(symbol);
                    // Reset selected level in flamegraph when selecting row in top table
                    setRangeMin(0);
                    setRangeMax(1);
                  }
                }}
              />
            )}

            {selectedView !== SelectedView.TopTable && (
              <FlameGraph
                data={dataContainer}
                levels={levels}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
                search={search}
                setRangeMin={setRangeMin}
                setRangeMax={setRangeMax}
                selectedView={selectedView}
                onItemFocused={(itemIndex) => setFocusedItemIndex(itemIndex)}
                focusedItemIndex={focusedItemIndex}
                textAlign={textAlign}
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
      gap: theme.spacing(1),
    }),
    body: css({
      display: 'flex',
      flexGrow: 1,
      minHeight: 0,
    }),
  };
}

export default FlameGraphContainer;
