import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, CoreApp, GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import FlameGraph from './FlameGraph/FlameGraph';
import { FlameGraphDataContainer } from './FlameGraph/dataTransform';
import FlameGraphHeader from './FlameGraphHeader';
import FlameGraphTopTableContainer from './TopTable/FlameGraphTopTableContainer';
import { ClickedItemData, ColorScheme, SelectedView, TextAlign } from './types';

type Props = {
  data?: DataFrame;
  app: CoreApp;
};

const FlameGraphContainer = (props: Props) => {
  const [focusedItemData, setFocusedItemData] = useState<ClickedItemData>();

  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedView, setSelectedView] = useState(SelectedView.Both);
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  // This is a label of the item because in sandwich view we group all items by label and present a merged graph
  const [sandwichItem, setSandwichItem] = useState<string>();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(ColorScheme.ValueBased);

  const theme = useTheme2();

  const dataContainer = useMemo((): FlameGraphDataContainer | undefined => {
    if (!props.data) {
      return;
    }
    return new FlameGraphDataContainer(props.data, theme);
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

  function resetFocus() {
    setFocusedItemData(undefined);
    setRangeMin(0);
    setRangeMax(1);
  }

  function resetSandwich() {
    setSandwichItem(undefined);
  }

  useEffect(() => {
    resetFocus();
    resetSandwich();
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
              resetFocus();
              resetSandwich();
            }}
            textAlign={textAlign}
            onTextAlignChange={setTextAlign}
            showResetButton={Boolean(focusedItemData || sandwichItem)}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
          />

          <div className={styles.body}>
            {selectedView !== SelectedView.FlameGraph && (
              <FlameGraphTopTableContainer
                data={dataContainer}
                app={props.app}
                onSymbolClick={(symbol) => {
                  if (search === symbol) {
                    setSearch('');
                  } else {
                    reportInteraction('grafana_flamegraph_table_item_selected', {
                      app: props.app,
                      grafana_version: config.buildInfo.version,
                    });
                    setSearch(symbol);
                  }
                }}
                height={selectedView === SelectedView.TopTable ? 600 : undefined}
              />
            )}

            {selectedView !== SelectedView.TopTable && (
              <FlameGraph
                data={dataContainer}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
                search={search}
                setRangeMin={setRangeMin}
                setRangeMax={setRangeMax}
                onItemFocused={(data) => setFocusedItemData(data)}
                focusedItemData={focusedItemData}
                textAlign={textAlign}
                sandwichItem={sandwichItem}
                onSandwich={(label: string) => {
                  resetFocus();
                  setSandwichItem(label);
                }}
                onFocusPillClick={resetFocus}
                onSandwichPillClick={resetSandwich}
                colorScheme={colorScheme}
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
