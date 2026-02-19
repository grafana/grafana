import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { useDebounce, usePrevious } from 'react-use';

import { ChatContextItem, OpenAssistantButton } from '@grafana/assistant';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, ButtonGroup, Dropdown, IconButton, Input, Menu, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { ColorSchemeButton } from './ColorSchemeButton';
import { CollapsedMap } from './FlameGraph/dataTransform';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH, MIN_WIDTH_TO_SHOW_SPLIT_PANE_SELECTORS } from './constants';
import { ColorScheme, ColorSchemeDiff, PaneView, SelectedView, TextAlign, ViewMode } from './types';

type LegacyProps = {
  search: string;
  setSearch: (search: string) => void;
  selectedView: SelectedView;
  setSelectedView: (view: SelectedView) => void;
  containerWidth: number;
  onReset: () => void;
  textAlign: TextAlign;
  onTextAlignChange: (align: TextAlign) => void;
  showResetButton: boolean;
  colorScheme: ColorScheme | ColorSchemeDiff;
  onColorSchemeChange: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  stickyHeader: boolean;
  vertical?: boolean;
  isDiffMode: boolean;
  setCollapsedMap: (collapsedMap: CollapsedMap) => void;
  collapsedMap: CollapsedMap;

  extraHeaderElements?: React.ReactNode;

  assistantContext?: ChatContextItem[];
};

type NewUIProps = {
  search: string;
  setSearch: (search: string) => void;
  enableNewUI: true;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  canShowSplitView: boolean;
  containerWidth: number;
  leftPaneView: PaneView;
  setLeftPaneView: (view: PaneView) => void;
  rightPaneView: PaneView;
  setRightPaneView: (view: PaneView) => void;
  singleView: PaneView;
  setSingleView: (view: PaneView) => void;
  onSwapPanes: () => void;
  onReset: () => void;
  showResetButton: boolean;
  stickyHeader: boolean;

  extraHeaderElements?: React.ReactNode;

  assistantContext?: ChatContextItem[];
};

type Props = LegacyProps | NewUIProps;

function isNewUI(props: Props): props is NewUIProps {
  return 'enableNewUI' in props && props.enableNewUI === true;
}

const FlameGraphHeader = (props: Props) => {
  const styles = useStyles2(getStyles);
  const [localSearch, setLocalSearch] = useSearchInput(props.search, props.setSearch);

  const suffix =
    localSearch !== '' ? (
      <Button
        icon="times"
        fill="text"
        size="sm"
        onClick={() => {
          // We could set only one and wait them to sync but there is no need to debounce this.
          props.setSearch('');
          setLocalSearch('');
        }}
      >
        Clear
      </Button>
    ) : null;

  if (isNewUI(props)) {
    const effectiveViewMode = props.canShowSplitView ? props.viewMode : ViewMode.Single;

    return (
      <div className={cx(styles.header, styles.headerNew, { [styles.stickyHeader]: props.stickyHeader })}>
        <div className={styles.inputContainerNew}>
          <Input
            value={localSearch || ''}
            onChange={(v) => {
              setLocalSearch(v.currentTarget.value);
            }}
            placeholder={'Search...'}
            suffix={suffix}
          />
        </div>

        {effectiveViewMode === ViewMode.Split && (
          <div className={styles.middleContainer}>
            {props.containerWidth >= MIN_WIDTH_TO_SHOW_SPLIT_PANE_SELECTORS ? (
              <>
                <RadioButtonGroup<PaneView>
                  size="sm"
                  options={paneViewOptions}
                  value={props.leftPaneView}
                  onChange={props.setLeftPaneView}
                  className={styles.buttonSpacing}
                />
                <IconButton name="exchange-alt" size="sm" tooltip="Swap views" onClick={props.onSwapPanes} />
                <RadioButtonGroup<PaneView>
                  size="sm"
                  options={paneViewOptions}
                  value={props.rightPaneView}
                  onChange={props.setRightPaneView}
                  className={styles.buttonSpacing}
                />
              </>
            ) : (
              <>
                <Dropdown
                  overlay={
                    <Menu>
                      {paneViewOptions.map((option) => (
                        <Menu.Item
                          key={option.value}
                          label={option.label ?? ''}
                          active={props.leftPaneView === option.value}
                          onClick={() => option.value && props.setLeftPaneView(option.value)}
                        />
                      ))}
                    </Menu>
                  }
                >
                  <Button variant="secondary" size="sm" className={styles.paneDropdownButton}>
                    {paneViewOptions.find((o) => o.value === props.leftPaneView)?.label}
                  </Button>
                </Dropdown>
                <IconButton name="exchange-alt" size="sm" tooltip="Swap views" onClick={props.onSwapPanes} />
                <Dropdown
                  overlay={
                    <Menu>
                      {paneViewOptions.map((option) => (
                        <Menu.Item
                          key={option.value}
                          label={option.label ?? ''}
                          active={props.rightPaneView === option.value}
                          onClick={() => option.value && props.setRightPaneView(option.value)}
                        />
                      ))}
                    </Menu>
                  }
                >
                  <Button variant="secondary" size="sm" className={styles.paneDropdownButton}>
                    {paneViewOptions.find((o) => o.value === props.rightPaneView)?.label}
                  </Button>
                </Dropdown>
              </>
            )}
          </div>
        )}

        <div className={styles.rightContainer}>
          {!!props.assistantContext?.length && (
            <div className={styles.buttonSpacing}>
              <OpenAssistantButton
                origin="grafana/flame-graph"
                prompt="Analyze this flamegraph by querying the current datasource"
                context={props.assistantContext}
              />
            </div>
          )}
          {props.showResetButton && (
            <Button
              variant={'secondary'}
              fill={'outline'}
              size={'sm'}
              icon={'history-alt'}
              tooltip={'Reset focus and sandwich state'}
              onClick={() => {
                props.onReset();
              }}
              className={styles.buttonSpacing}
              aria-label={'Reset focus and sandwich state'}
            />
          )}
          {effectiveViewMode === ViewMode.Single && (
            <RadioButtonGroup<PaneView>
              size="sm"
              options={paneViewOptions}
              value={props.singleView}
              onChange={props.setSingleView}
              className={styles.buttonSpacing}
            />
          )}
          {props.canShowSplitView && (
            <RadioButtonGroup<ViewMode>
              size="sm"
              options={viewModeOptions}
              value={props.viewMode}
              onChange={props.setViewMode}
              className={styles.buttonSpacing}
            />
          )}
          {props.extraHeaderElements && <div className={styles.extraElements}>{props.extraHeaderElements}</div>}
        </div>
      </div>
    );
  }

  // Legacy UI rendering
  const {
    selectedView,
    setSelectedView,
    containerWidth,
    onReset,
    textAlign,
    onTextAlignChange,
    showResetButton,
    colorScheme,
    onColorSchemeChange,
    stickyHeader,
    extraHeaderElements,
    vertical,
    isDiffMode,
    setCollapsedMap,
    collapsedMap,
    assistantContext,
  } = props;

  return (
    <div className={cx(styles.header, { [styles.stickyHeader]: stickyHeader })}>
      <div className={styles.inputContainer}>
        <Input
          value={localSearch || ''}
          onChange={(v) => {
            setLocalSearch(v.currentTarget.value);
          }}
          placeholder={'Search...'}
          suffix={suffix}
        />
      </div>

      <div className={styles.rightContainer}>
        {!!assistantContext?.length && (
          <div className={styles.buttonSpacing}>
            <OpenAssistantButton
              origin="grafana/flame-graph"
              prompt="Analyze this flamegraph by querying the current datasource"
              context={assistantContext}
            />
          </div>
        )}
        {showResetButton && (
          <Button
            variant={'secondary'}
            fill={'outline'}
            size={'sm'}
            icon={'history-alt'}
            tooltip={'Reset focus and sandwich state'}
            onClick={() => {
              onReset();
            }}
            className={styles.buttonSpacing}
            aria-label={'Reset focus and sandwich state'}
          />
        )}
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
            disabled={selectedView === SelectedView.TopTable}
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
            disabled={selectedView === SelectedView.TopTable}
          />
        </ButtonGroup>
        <RadioButtonGroup<TextAlign>
          size="sm"
          disabled={selectedView === SelectedView.TopTable}
          options={alignOptions}
          value={textAlign}
          onChange={onTextAlignChange}
          className={styles.buttonSpacing}
        />
        <RadioButtonGroup<SelectedView>
          size="sm"
          options={getViewOptions(containerWidth, vertical)}
          value={selectedView}
          onChange={setSelectedView}
        />
        {extraHeaderElements && <div className={styles.extraElements}>{extraHeaderElements}</div>}
      </div>
    </div>
  );
};

const alignOptions: Array<SelectableValue<TextAlign>> = [
  { value: 'left', description: 'Align text left', icon: 'align-left' },
  { value: 'right', description: 'Align text right', icon: 'align-right' },
];

const viewModeOptions: Array<SelectableValue<ViewMode>> = [
  { value: ViewMode.Single, label: 'Single', description: 'Single view' },
  { value: ViewMode.Split, label: 'Split', description: 'Split view' },
];

const paneViewOptions: Array<SelectableValue<PaneView>> = [
  { value: PaneView.TopTable, label: 'Top Table' },
  { value: PaneView.FlameGraph, label: 'Flame Graph' },
  { value: PaneView.CallTree, label: 'Call Tree' },
];

function getViewOptions(width: number, vertical?: boolean): Array<SelectableValue<SelectedView>> {
  let viewOptions: Array<{ value: SelectedView; label: string; description: string }> = [
    { value: SelectedView.TopTable, label: 'Top Table', description: 'Only show top table' },
    { value: SelectedView.FlameGraph, label: 'Flame Graph', description: 'Only show flame graph' },
  ];

  if (width >= MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH || vertical) {
    viewOptions.push({
      value: SelectedView.Both,
      label: 'Both',
      description: 'Show both the top table and flame graph',
    });
  }

  return viewOptions;
}

function useSearchInput(
  search: string,
  setSearch: (search: string) => void
): [string | undefined, (search: string) => void] {
  const [localSearchState, setLocalSearchState] = useState(search);
  const prevSearch = usePrevious(search);

  // Debouncing cause changing parent search triggers rerender on both the flamegraph and table
  useDebounce(
    () => {
      setSearch(localSearchState);
    },
    250,
    [localSearchState]
  );

  // Make sure we still handle updates from parent (from clicking on a table item for example). We check if the parent
  // search value changed to something that isn't our local value.
  useEffect(() => {
    if (prevSearch !== search && search !== localSearchState) {
      setLocalSearchState(search);
    }
  }, [search, prevSearch, localSearchState]);

  return [localSearchState, setLocalSearchState];
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    label: 'header',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    top: 0,
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
  headerNew: css({
    label: 'headerNew',
    alignItems: 'flex-start',
    position: 'relative',
  }),
  stickyHeader: css({
    zIndex: theme.zIndex.navbarFixed,
    position: 'sticky',
    background: theme.colors.background.primary,
  }),
  inputContainer: css({
    label: 'inputContainer',
    flexGrow: 1,
    minWidth: '150px',
    maxWidth: '350px',
  }),
  inputContainerNew: css({
    label: 'inputContainerNew',
    flexGrow: 0,
    minWidth: '150px',
    maxWidth: '350px',
  }),
  middleContainer: css({
    label: 'middleContainer',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  }),
  rightContainer: css({
    label: 'rightContainer',
    display: 'flex',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  }),
  buttonSpacing: css({
    label: 'buttonSpacing',
    marginRight: theme.spacing(1),
  }),
  resetButton: css({
    label: 'resetButton',
    display: 'flex',
    marginRight: theme.spacing(2),
  }),
  resetButtonIconWrapper: css({
    label: 'resetButtonIcon',
    padding: '0 5px',
    color: theme.colors.text.disabled,
  }),
  extraElements: css({
    label: 'extraElements',
    marginLeft: theme.spacing(1),
  }),
  paneDropdownButton: css({
    label: 'paneDropdownButton',
    minWidth: '95px',
    justifyContent: 'center',
  }),
});

export default FlameGraphHeader;
