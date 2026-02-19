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

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, ButtonGroup, Icon, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { ColorSchemeButton } from '../ColorSchemeButton';
import { PIXELS_PER_LEVEL } from '../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, PaneView, SelectedView, ViewMode, TextAlign } from '../types';

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
  search: string;
  collapsedMap: CollapsedMap;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;

  // Legacy props
  selectedView?: SelectedView;

  // New UI props (when viewMode is provided, renders toolbar with controls)
  viewMode?: ViewMode;
  paneView?: PaneView;
  onTextAlignChange?: (align: TextAlign) => void;
  onColorSchemeChange?: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  isDiffMode?: boolean;
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
  search,
  collapsedMap,
  setCollapsedMap,
  selectedView,
  viewMode,
  paneView,
  onTextAlignChange,
  onColorSchemeChange,
  isDiffMode,
}: Props) => {
  const isNewUI = viewMode !== undefined;
  const newStyles = useStyles2(getStylesNew);
  const legacyStyles = getStylesLegacy();

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
    viewMode,
    paneView,
  };
  let canvas = null;

  // Both style objects share sandwich/canvas styles, pick the right one based on mode.
  const canvasStyles = isNewUI ? newStyles : legacyStyles;

  if (levelsCallers?.length) {
    canvas = (
      <>
        <div className={canvasStyles.sandwichCanvasWrapper}>
          <div className={canvasStyles.sandwichMarker}>
            Callers
            <Icon className={canvasStyles.sandwichMarkerIcon} name={'arrow-down'} />
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

        <div className={canvasStyles.sandwichCanvasWrapper}>
          <div className={cx(canvasStyles.sandwichMarker, canvasStyles.sandwichMarkerCalees)}>
            <Icon className={canvasStyles.sandwichMarkerIcon} name={'arrow-up'} />
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

  if (isNewUI) {
    const alignOptions: Array<SelectableValue<TextAlign>> = [
      { value: 'left', description: 'Align text left', icon: 'align-left' },
      { value: 'right', description: 'Align text right', icon: 'align-right' },
    ];

    return (
      <div className={newStyles.graph}>
        <div className={newStyles.toolbar}>
          <FlameGraphMetadata
            data={data}
            focusedItem={focusedItemData}
            sandwichedLabel={sandwichItem}
            totalTicks={totalViewTicks}
            onFocusPillClick={onFocusPillClick}
            onSandwichPillClick={onSandwichPillClick}
          />
          <div className={newStyles.controls}>
            {onColorSchemeChange && (
              <ColorSchemeButton value={colorScheme} onChange={onColorSchemeChange} isDiffMode={isDiffMode ?? false} />
            )}
            <ButtonGroup className={newStyles.buttonSpacing}>
              <Button
                variant={'secondary'}
                fill={'outline'}
                size={'sm'}
                tooltip={'Expand all groups'}
                onClick={() => {
                  setCollapsedMap(collapsedMap.setAllCollapsedStatus(false));
                }}
                aria-label={'Expand all groups'}
                icon={'angle-double-down'}
              />
              <Button
                variant={'secondary'}
                fill={'outline'}
                size={'sm'}
                tooltip={'Collapse all groups'}
                onClick={() => {
                  setCollapsedMap(collapsedMap.setAllCollapsedStatus(true));
                }}
                aria-label={'Collapse all groups'}
                icon={'angle-double-up'}
              />
            </ButtonGroup>
            {onTextAlignChange && (
              <RadioButtonGroup<TextAlign>
                size="sm"
                options={alignOptions}
                value={textAlign}
                onChange={onTextAlignChange}
              />
            )}
          </div>
        </div>
        {canvas}
      </div>
    );
  }

  return (
    <div className={legacyStyles.graph}>
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

const getStylesLegacy = () => ({
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

const getStylesNew = (theme: GrafanaTheme2) => ({
  graph: css({
    label: 'graph',
    overflow: 'auto',
    flexGrow: 1,
    flexBasis: '50%',
  }),
  toolbar: css({
    label: 'toolbar',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  }),
  controls: css({
    label: 'controls',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  buttonSpacing: css({
    label: 'buttonSpacing',
    marginRight: theme.spacing(1),
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
