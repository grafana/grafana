import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import useDebounce from 'react-use/lib/useDebounce';
import usePrevious from 'react-use/lib/usePrevious';

import { CoreApp, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Input, Menu, RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { config } from '../../../../../core/config';
import { MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH } from '../constants';

import { byPackageGradient, byValueGradient } from './FlameGraph/colors';
import { ColorScheme, SelectedView, TextAlign } from './types';

type Props = {
  app: CoreApp;
  search: string;
  setSearch: (search: string) => void;
  selectedView: SelectedView;
  setSelectedView: (view: SelectedView) => void;
  containerWidth: number;
  onReset: () => void;
  textAlign: TextAlign;
  onTextAlignChange: (align: TextAlign) => void;
  showResetButton: boolean;
  colorScheme: ColorScheme;
  onColorSchemeChange: (colorScheme: ColorScheme) => void;
};

const FlameGraphHeader = ({
  app,
  search,
  setSearch,
  selectedView,
  setSelectedView,
  containerWidth,
  onReset,
  textAlign,
  onTextAlignChange,
  showResetButton,
  colorScheme,
  onColorSchemeChange,
}: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, app));
  function interaction(name: string, context: Record<string, string | number>) {
    reportInteraction(`grafana_flamegraph_${name}`, {
      app,
      grafana_version: config.buildInfo.version,
      ...context,
    });
  }

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

  return (
    <div className={styles.header}>
      <div className={styles.inputContainer}>
        <Input
          value={localSearch || ''}
          onChange={(v) => {
            setLocalSearch(v.currentTarget.value);
          }}
          placeholder={'Search..'}
          width={44}
          suffix={suffix}
        />
      </div>

      <div className={styles.rightContainer}>
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
        <ColorSchemeButton app={app} value={colorScheme} onChange={onColorSchemeChange} />
        <RadioButtonGroup<TextAlign>
          size="sm"
          disabled={selectedView === SelectedView.TopTable}
          options={alignOptions}
          value={textAlign}
          onChange={(val) => {
            interaction('text_align_selected', { align: val });
            onTextAlignChange(val);
          }}
          className={styles.buttonSpacing}
        />
        <RadioButtonGroup<SelectedView>
          size="sm"
          options={getViewOptions(containerWidth)}
          value={selectedView}
          onChange={(view) => {
            interaction('view_selected', { view });
            setSelectedView(view);
          }}
        />
      </div>
    </div>
  );
};

type ColorSchemeButtonProps = {
  app: CoreApp;
  value: ColorScheme;
  onChange: (colorScheme: ColorScheme) => void;
};
function ColorSchemeButton(props: ColorSchemeButtonProps) {
  const styles = useStyles2((theme) => getStyles(theme, props.app));
  const menu = (
    <Menu>
      <Menu.Item label="By value" onClick={() => props.onChange(ColorScheme.ValueBased)} />
      <Menu.Item label="By package name" onClick={() => props.onChange(ColorScheme.PackageBased)} />
    </Menu>
  );
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
        <span
          className={cx(
            styles.colorDot,
            // Show a bit different gradient as a way to indicate selected value
            props.value === ColorScheme.ValueBased ? styles.colorDotByValue : styles.colorDotByPackage
          )}
        />
      </Button>
    </Dropdown>
  );
}

const alignOptions: Array<SelectableValue<TextAlign>> = [
  { value: 'left', description: 'Align text left', icon: 'align-left' },
  { value: 'right', description: 'Align text right', icon: 'align-right' },
];

function getViewOptions(width: number): Array<SelectableValue<SelectedView>> {
  let viewOptions: Array<{ value: SelectedView; label: string; description: string }> = [
    { value: SelectedView.TopTable, label: 'Top Table', description: 'Only show top table' },
    { value: SelectedView.FlameGraph, label: 'Flame Graph', description: 'Only show flame graph' },
  ];

  if (width >= MIN_WIDTH_TO_SHOW_BOTH_TOPTABLE_AND_FLAMEGRAPH) {
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

const getStyles = (theme: GrafanaTheme2, app: CoreApp) => ({
  header: css`
    label: header;
    display: flex;
    justify-content: space-between;
    width: 100%;
    background: ${theme.colors.background.primary};
    top: 0;
    z-index: ${theme.zIndex.navbarFixed};
    ${app === CoreApp.Explore
      ? css`
          position: sticky;
          padding-bottom: ${theme.spacing(1)};
          padding-top: ${theme.spacing(1)};
        `
      : ''};
  `,
  inputContainer: css`
    label: inputContainer;
    margin-right: 20px;
  `,
  rightContainer: css`
    label: rightContainer;
    display: flex;
    align-items: flex-start;
  `,
  buttonSpacing: css`
    label: buttonSpacing;
    margin-right: ${theme.spacing(1)};
  `,

  resetButton: css`
    label: resetButton;
    display: flex;
    margin-right: ${theme.spacing(2)};
  `,
  resetButtonIconWrapper: css`
    label: resetButtonIcon;
    padding: 0 5px;
    color: ${theme.colors.text.disabled};
  `,
  colorDot: css`
    label: colorDot;
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  `,
  colorDotByValue: css`
    label: colorDotByValue;
    background: ${byValueGradient};
  `,
  colorDotByPackage: css`
    label: colorDotByPackage;
    background: ${byPackageGradient};
  `,
});

export default FlameGraphHeader;
