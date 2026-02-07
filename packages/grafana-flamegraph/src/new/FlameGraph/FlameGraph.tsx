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

/**
 * NEW UI VERSION - Copy of ../FlameGraph/FlameGraph.tsx with modifications for the new pane-based UI.
 *
 * Key changes from the legacy version:
 * - Props: Replaced `selectedView: SelectedView` with `viewMode: ViewMode` and `paneView: PaneView`
 * - Props: Added `onTextAlignChange`, `onColorSchemeChange`, `isDiffMode` callbacks
 * - Moved text align, color scheme, and collapse controls from FlameGraphHeader into this component's toolbar
 *
 * When the new UI is stable and the legacy UI is removed, this file should replace
 * ../FlameGraph/FlameGraph.tsx and these comments should be removed.
 */

import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, ButtonGroup, Dropdown, Icon, Menu, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import FlameGraphMetadata from '../../FlameGraph/FlameGraphMetadata';
import {
  byPackageGradient,
  byValueGradient,
  diffColorBlindGradient,
  diffDefaultGradient,
} from '../../FlameGraph/colors';
import { CollapsedMap, FlameGraphDataContainer, LevelItem } from '../../FlameGraph/dataTransform';
import { PIXELS_PER_LEVEL } from '../../constants';
import { ClickedItemData, ColorScheme, ColorSchemeDiff, PaneView, ViewMode, TextAlign } from '../../types';

import FlameGraphCanvas from './FlameGraphCanvas';
import { GetExtraContextMenuButtonsFunction } from './FlameGraphContextMenu';

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
  onTextAlignChange: (align: TextAlign) => void;
  sandwichItem?: string;
  onSandwich: (label: string) => void;
  onFocusPillClick: () => void;
  onSandwichPillClick: () => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
  onColorSchemeChange: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  isDiffMode: boolean;
  showFlameGraphOnly?: boolean;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  collapsing?: boolean;
  viewMode: ViewMode;
  paneView: PaneView;
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
  onTextAlignChange,
  onSandwich,
  sandwichItem,
  onFocusPillClick,
  onSandwichPillClick,
  colorScheme,
  onColorSchemeChange,
  isDiffMode,
  showFlameGraphOnly,
  getExtraContextMenuButtons,
  collapsing,
  viewMode,
  paneView,
  search,
  collapsedMap,
  setCollapsedMap,
}: Props) => {
  const styles = useStyles2(getStyles);

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
    viewMode,
    paneView,
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

  const alignOptions: Array<SelectableValue<TextAlign>> = [
    { value: 'left', description: 'Align text left', icon: 'align-left' },
    { value: 'right', description: 'Align text right', icon: 'align-right' },
  ];

  return (
    <div className={styles.graph}>
      <div className={styles.toolbar}>
        <FlameGraphMetadata
          data={data}
          focusedItem={focusedItemData}
          sandwichedLabel={sandwichItem}
          totalTicks={totalViewTicks}
          onFocusPillClick={onFocusPillClick}
          onSandwichPillClick={onSandwichPillClick}
        />
        <div className={styles.controls}>
          <ColorSchemeButton value={colorScheme} onChange={onColorSchemeChange} isDiffMode={isDiffMode} />
          <ButtonGroup className={styles.buttonSpacing}>
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
          <RadioButtonGroup<TextAlign>
            size="sm"
            options={alignOptions}
            value={textAlign}
            onChange={onTextAlignChange}
          />
        </div>
      </div>
      {canvas}
    </div>
  );
};

type ColorSchemeButtonProps = {
  value: ColorScheme | ColorSchemeDiff;
  onChange: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  isDiffMode: boolean;
};

function ColorSchemeButton(props: ColorSchemeButtonProps) {
  const styles = useStyles2(getStyles);
  let menu = (
    <Menu>
      <Menu.Item label="By package name" onClick={() => props.onChange(ColorScheme.PackageBased)} />
      <Menu.Item label="By value" onClick={() => props.onChange(ColorScheme.ValueBased)} />
    </Menu>
  );

  // Show a bit different gradient as a way to indicate selected value
  const colorDotStyle =
    {
      [ColorScheme.ValueBased]: styles.colorDotByValue,
      [ColorScheme.PackageBased]: styles.colorDotByPackage,
      [ColorSchemeDiff.DiffColorBlind]: styles.colorDotDiffColorBlind,
      [ColorSchemeDiff.Default]: styles.colorDotDiffDefault,
    }[props.value] || styles.colorDotByValue;

  let contents = <span className={cx(styles.colorDot, colorDotStyle)} />;

  if (props.isDiffMode) {
    menu = (
      <Menu>
        <Menu.Item label="Default (green to red)" onClick={() => props.onChange(ColorSchemeDiff.Default)} />
        <Menu.Item label="Color blind (blue to red)" onClick={() => props.onChange(ColorSchemeDiff.DiffColorBlind)} />
      </Menu>
    );

    contents = (
      <div className={cx(styles.colorDotDiff, colorDotStyle)}>
        <div>-100% (removed)</div>
        <div>0%</div>
        <div>+100% (added)</div>
      </div>
    );
  }

  return (
    <Dropdown overlay={menu}>
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        tooltip={'Change color scheme'}
        onClick={() => {}}
        className={styles.buttonSpacing}
        aria-label={'Change color scheme'}
      >
        {contents}
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
  colorDot: css({
    label: 'colorDot',
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
  }),
  colorDotDiff: css({
    label: 'colorDotDiff',
    display: 'flex',
    width: '200px',
    height: '12px',
    color: 'white',
    fontSize: 9,
    lineHeight: 1.3,
    fontWeight: 300,
    justifyContent: 'space-between',
    padding: '0 2px',
    // We have a specific sizing for this so probably makes sense to use hardcoded value here
    // eslint-disable-next-line @grafana/no-border-radius-literal
    borderRadius: '2px',
  }),
  colorDotByValue: css({
    label: 'colorDotByValue',
    background: byValueGradient,
  }),
  colorDotByPackage: css({
    label: 'colorDotByPackage',
    background: byPackageGradient,
  }),
  colorDotDiffDefault: css({
    label: 'colorDotDiffDefault',
    background: diffDefaultGradient,
  }),
  colorDotDiffColorBlind: css({
    label: 'colorDotDiffColorBlind',
    background: diffColorBlindGradient,
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
