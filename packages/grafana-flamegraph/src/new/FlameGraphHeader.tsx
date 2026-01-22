/**
 * NEW UI VERSION - Copy of ../FlameGraphHeader.tsx with significant modifications.
 *
 * Key changes from the legacy version:
 * - Complete redesign to support the new pane-based UI with split view
 * - Props: Replaced `selectedView/setSelectedView` with `viewMode/setViewMode` and pane view controls
 * - Props: Added `leftPaneView`, `rightPaneView`, `singleView` and their setters for pane management
 * - Props: Added `onSwapPanes`, `canShowSplitView` for split view functionality
 * - Props: Removed `textAlign`, `colorScheme`, `collapsedMap` controls (moved to FlameGraph component)
 * - Added pane selector RadioButtonGroups for left/right pane view selection
 * - Added swap panes button
 *
 * When the new UI is stable, this file should replace ../FlameGraphHeader.tsx
 */

import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { useDebounce, usePrevious } from 'react-use';

import { ChatContextItem, OpenAssistantButton } from '@grafana/assistant';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Dropdown, IconButton, Input, Menu, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { MIN_WIDTH_TO_SHOW_SPLIT_PANE_SELECTORS } from '../constants';
import { PaneView, ViewMode } from '../types';

type Props = {
  search: string;
  setSearch: (search: string) => void;
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

const FlameGraphHeader = ({
  search,
  setSearch,
  viewMode,
  setViewMode,
  canShowSplitView,
  containerWidth,
  leftPaneView,
  setLeftPaneView,
  rightPaneView,
  setRightPaneView,
  singleView,
  setSingleView,
  onSwapPanes,
  onReset,
  showResetButton,
  stickyHeader,
  extraHeaderElements,
  assistantContext,
}: Props) => {
  const styles = useStyles2(getStyles);
  const [localSearch, setLocalSearch] = useSearchInput(search, setSearch);

  const suffix =
    localSearch !== '' ? (
      <Button
        icon="times"
        fill="text"
        size="sm"
        onClick={() => {
          // We could set only one and wait them to sync but there is no need to debounce this.
          setSearch('');
          setLocalSearch('');
        }}
      >
        Clear
      </Button>
    ) : null;

  // Effective view mode: if we can't show split, force single
  const effectiveViewMode = canShowSplitView ? viewMode : ViewMode.Single;

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

      {effectiveViewMode === ViewMode.Split && (
        <div className={styles.middleContainer}>
          {containerWidth >= MIN_WIDTH_TO_SHOW_SPLIT_PANE_SELECTORS ? (
            <>
              <RadioButtonGroup<PaneView>
                size="sm"
                options={paneViewOptions}
                value={leftPaneView}
                onChange={setLeftPaneView}
                className={styles.buttonSpacing}
              />
              <IconButton name="exchange-alt" size="sm" tooltip="Swap views" onClick={onSwapPanes} />
              <RadioButtonGroup<PaneView>
                size="sm"
                options={paneViewOptions}
                value={rightPaneView}
                onChange={setRightPaneView}
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
                        active={leftPaneView === option.value}
                        onClick={() => option.value && setLeftPaneView(option.value)}
                      />
                    ))}
                  </Menu>
                }
              >
                <Button variant="secondary" size="sm" className={styles.paneDropdownButton}>
                  {paneViewOptions.find((o) => o.value === leftPaneView)?.label}
                </Button>
              </Dropdown>
              <IconButton name="exchange-alt" size="sm" tooltip="Swap views" onClick={onSwapPanes} />
              <Dropdown
                overlay={
                  <Menu>
                    {paneViewOptions.map((option) => (
                      <Menu.Item
                        key={option.value}
                        label={option.label ?? ''}
                        active={rightPaneView === option.value}
                        onClick={() => option.value && setRightPaneView(option.value)}
                      />
                    ))}
                  </Menu>
                }
              >
                <Button variant="secondary" size="sm" className={styles.paneDropdownButton}>
                  {paneViewOptions.find((o) => o.value === rightPaneView)?.label}
                </Button>
              </Dropdown>
            </>
          )}
        </div>
      )}

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
        {effectiveViewMode === ViewMode.Single && (
          <RadioButtonGroup<PaneView>
            size="sm"
            options={paneViewOptions}
            value={singleView}
            onChange={setSingleView}
            className={styles.buttonSpacing}
          />
        )}
        {canShowSplitView && (
          <RadioButtonGroup<ViewMode>
            size="sm"
            options={viewModeOptions}
            value={viewMode}
            onChange={setViewMode}
            className={styles.buttonSpacing}
          />
        )}
        {extraHeaderElements && <div className={styles.extraElements}>{extraHeaderElements}</div>}
      </div>
    </div>
  );
};

const viewModeOptions: Array<SelectableValue<ViewMode>> = [
  { value: ViewMode.Single, label: 'Single', description: 'Single view' },
  { value: ViewMode.Split, label: 'Split', description: 'Split view' },
];

const paneViewOptions: Array<SelectableValue<PaneView>> = [
  { value: PaneView.TopTable, label: 'Top Table' },
  { value: PaneView.FlameGraph, label: 'Flame Graph' },
  { value: PaneView.CallTree, label: 'Call Tree' },
];

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
    alignItems: 'flex-start',
    width: '100%',
    top: 0,
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    position: 'relative',
  }),
  stickyHeader: css({
    zIndex: theme.zIndex.navbarFixed,
    position: 'sticky',
    background: theme.colors.background.primary,
  }),
  inputContainer: css({
    label: 'inputContainer',
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
