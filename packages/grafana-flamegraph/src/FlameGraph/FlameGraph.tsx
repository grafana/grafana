// This component is based on logic from the flamebearer project
// https://github.com/mapbox/flamebearer

// ISC License

// Copyright (c) 2018, Mapbox

// Permission to use, copy, modify, and/or distribute this software for any purpose
// with or without fee is hereby granted, provided that the above copyright notice
// and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
// REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
// INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
// OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
// TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.
import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import * as React from 'react';

import { Icon } from '@grafana/ui';

import { PIXELS_PER_LEVEL } from '../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, SelectedView, TextAlign } from '../types';

import FlameGraphCanvas from './FlameGraphCanvas';
import { GetExtraContextMenuButtonsFunction } from './FlameGraphContextMenu';
import FlameGraphMetadata from './FlameGraphMetadata';
import { CollapsedMap, FlameGraphDataContainer, LevelItem } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  rangeMin: number;
  rangeMax: number;
  matchedLabels?: Set<string>;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
  style?: React.CSSProperties;
  onItemFocused: (data: ClickedItemData) => void;
  focusedItemData?: ClickedItemData;
  textAlign: TextAlign;
  sandwichItem?: string;
  onSandwich: (label: string) => void;
  onFocusPillClick: () => void;
  onSandwichPillClick: () => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
  showFlameGraphOnly?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  collapsing?: boolean;
  selectedView: SelectedView;
  search: string;
  collapsedMap: CollapsedMap;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;
};

const FlameGraph = ({
  data,
  rangeMin,
  rangeMax,
  matchedLabels,
  setRangeMin,
  setRangeMax,
  onItemFocused,
  focusedItemData,
  textAlign,
  onSandwich,
  sandwichItem,
  onFocusPillClick,
  onSandwichPillClick,
  colorScheme,
  showFlameGraphOnly,
  getExtraContextMenuButtons,
  collapsing,
  selectedView,
  search,
  collapsedMap,
  setCollapsedMap,
}: Props) => {
  const styles = getStyles();

  const [levels, setLevels] = useState<LevelItem[][]>();
  const [levelsCallers, setLevelsCallers] = useState<LevelItem[][]>();
  const [totalProfileTicks, setTotalProfileTicks] = useState<number>(0);
  const [totalProfileTicksRight, setTotalProfileTicksRight] = useState<number>();
  const [totalViewTicks, setTotalViewTicks] = useState<number>(0);

  useEffect(() => {
    if (data) {
      let levels = data.getLevels();
      let totalProfileTicks = levels.length ? levels[0][0].value : 0;
      let totalProfileTicksRight = levels.length ? levels[0][0].valueRight : undefined;
      let totalViewTicks = totalProfileTicks;
      let levelsCallers = undefined;

      if (sandwichItem) {
        const [callers, callees] = data.getSandwichLevels(sandwichItem);
        levels = callees;
        levelsCallers = callers;
        // We need this separate as in case of diff profile we want to compute diff colors based on the original ticks.
        totalViewTicks = callees[0]?.[0]?.value ?? 0;
      }
      setLevels(levels);
      setLevelsCallers(levelsCallers);
      setTotalProfileTicks(totalProfileTicks);
      setTotalProfileTicksRight(totalProfileTicksRight);
      setTotalViewTicks(totalViewTicks);
    }
  }, [data, sandwichItem]);

  if (!levels) {
    return null;
  }

  const commonCanvasProps = {
    data,
    rangeMin,
    rangeMax,
    matchedLabels,
    setRangeMin,
    setRangeMax,
    onItemFocused,
    focusedItemData,
    textAlign,
    onSandwich,
    colorScheme,
    totalProfileTicks,
    totalProfileTicksRight,
    totalViewTicks,
    showFlameGraphOnly,
    collapsedMap,
    setCollapsedMap,
    getExtraContextMenuButtons,
    collapsing,
    search,
    selectedView,
  };
  let canvas = null;

  if (levelsCallers?.length) {
    canvas = (
      <>
        <div className={styles.sandwichCanvasWrapper}>
          <div className={styles.sandwichMarker}>
            Callers
            <Icon className={styles.sandwichMarkerIcon} name={'arrow-down'} />
          </div>
          <FlameGraphCanvas
            {...commonCanvasProps}
            root={levelsCallers[levelsCallers.length - 1][0]}
            depth={levelsCallers.length}
            direction={'parents'}
            // We do not support collapsing in sandwich view for now.
            collapsing={false}
          />
        </div>

        <div className={styles.sandwichCanvasWrapper}>
          <div className={cx(styles.sandwichMarker, styles.sandwichMarkerCalees)}>
            <Icon className={styles.sandwichMarkerIcon} name={'arrow-up'} />
            Callees
          </div>
          <FlameGraphCanvas
            {...commonCanvasProps}
            root={levels[0][0]}
            depth={levels.length}
            direction={'children'}
            collapsing={false}
          />
        </div>
      </>
    );
  } else if (levels?.length) {
    canvas = (
      <FlameGraphCanvas {...commonCanvasProps} root={levels[0][0]} depth={levels.length} direction={'children'} />
    );
  }

  return (
    <div className={styles.graph}>
      <FlameGraphMetadata
        data={data}
        focusedItem={focusedItemData}
        sandwichedLabel={sandwichItem}
        totalTicks={totalViewTicks}
        onFocusPillClick={onFocusPillClick}
        onSandwichPillClick={onSandwichPillClick}
      />
      {canvas}
    </div>
  );
};

const getStyles = () => ({
  graph: css({
    label: 'graph',
    overflow: 'auto',
    flexGrow: 1,
    flexBasis: '50%',
  }),
  sandwichCanvasWrapper: css({
    label: 'sandwichCanvasWrapper',
    display: 'flex',
    marginBottom: `${PIXELS_PER_LEVEL / window.devicePixelRatio}px`,
  }),
  sandwichMarker: css({
    label: 'sandwichMarker',
    writingMode: 'vertical-lr',
    transform: 'rotate(180deg)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  }),
  sandwichMarkerCalees: css({
    label: 'sandwichMarkerCalees',
    textAlign: 'right',
  }),
  sandwichMarkerIcon: css({
    label: 'sandwichMarkerIcon',
    verticalAlign: 'baseline',
  }),
});

export default FlameGraph;
