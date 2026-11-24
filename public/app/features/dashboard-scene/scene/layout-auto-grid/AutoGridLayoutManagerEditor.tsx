import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  useFlagGrafanaDashboardsAutoHeightPanels,
  useFlagGrafanaDashboardsReportLayouts,
} from '@grafana/runtime/internal';
import {
  Alert,
  Button,
  Combobox,
  type ComboboxOption,
  Field,
  InlineSwitch,
  Input,
  RadioButtonList,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  changeAutoGridColumnLayout,
  changeAutoGridColumnWidth,
  changeAutoGridFillScreen,
  changeAutoGridFitContent,
  changeAutoGridMatchRowHeights,
  changeAutoGridMaxColumnCount,
  changeAutoGridMaxHeightCustom,
  changeAutoGridMaxHeightMode,
  changeAutoGridMinHeight,
  changeAutoGridRowHeight,
} from '../../actions/layout/changeAutoGridOption';

import {
  type AutoGridColumnLayout,
  type AutoGridColumnWidth,
  type AutoGridMaxHeightMode,
  type AutoGridMinHeight,
  type AutoGridRowHeight,
  type AutoGridLayoutManager,
} from './AutoGridLayoutManager';

export function getSidebarOptions(layoutManager: AutoGridLayoutManager): OptionsPaneItemDescriptor[] {
  const options: OptionsPaneItemDescriptor[] = [];

  options.push(
    new OptionsPaneItemDescriptor({
      id: 'layout-auto-grid-column-layout',
      title: t('dashboard-scene.get-edit-options.title.column-layout', 'Column layout'),
      skipField: true,
      useShowIf: () => useIsSplitAuthoringAvailable(layoutManager),
      render: () => <GridLayoutColumnSplit layoutManager={layoutManager} />,
    })
  );

  options.push(
    new OptionsPaneItemDescriptor({
      id: 'layout-auto-grid-column-options',
      title: t('dashboard-scene.get-edit-options.title.column-options', 'Column options'),
      skipField: true,
      render: () => <GridLayoutColumns layoutManager={layoutManager} />,
    })
  );

  options.push(
    new OptionsPaneItemDescriptor({
      id: 'layout-auto-grid-row-height',
      title: t('dashboard-scene.get-edit-options.title.row-height-options', 'Row height options'),
      skipField: true,
      render: () => <GridLayoutRows layoutManager={layoutManager} />,
    })
  );

  return options;
}

function useIsSplitAuthoringAvailable(layoutManager: AutoGridLayoutManager): boolean {
  const isEnabled = useFlagGrafanaDashboardsReportLayouts();
  const { columnLayout } = layoutManager.useState();
  // Authoring is gated; a saved split stays visible so it can be reset.
  return isEnabled || columnLayout !== undefined;
}

type ColumnLayoutChoice = 'even' | AutoGridColumnLayout;

function GridLayoutColumnSplit({ layoutManager }: { layoutManager: AutoGridLayoutManager }) {
  const { columnLayout } = layoutManager.useState();
  const { children } = layoutManager.state.layout.useState();
  const styles = useStyles2(getStyles);
  const split = layoutManager.getColumnSplit(children);

  const options: Array<{ label: string; value: ColumnLayoutChoice; description: string }> = [
    {
      label: t('dashboard.auto-grid.options.column-layout-even', 'Even'),
      value: 'even',
      description: t(
        'dashboard.auto-grid.options.column-layout-even-description',
        'Panels share the row equally using the column options below'
      ),
    },
    {
      label: t('dashboard.auto-grid.options.column-layout-wide-first', 'Wide first'),
      value: 'split-wide-first',
      description: t(
        'dashboard.auto-grid.options.column-layout-wide-first-description',
        'The first panel takes two thirds of the row'
      ),
    },
    {
      label: t('dashboard.auto-grid.options.column-layout-wide-second', 'Wide second'),
      value: 'split-wide-second',
      description: t(
        'dashboard.auto-grid.options.column-layout-wide-second-description',
        'The second panel takes two thirds of the row'
      ),
    },
  ];

  return (
    <div
      className={styles.optionGroup}
      data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.columnLayout}
    >
      <Field label={t('dashboard.auto-grid.options.column-layout', 'Column layout')} noMargin>
        <RadioButtonList
          name={`column-layout-${layoutManager.state.key}`}
          options={options}
          value={columnLayout ?? 'even'}
          onChange={(value) => changeAutoGridColumnLayout(layoutManager, value === 'even' ? undefined : value)}
        />
      </Field>
      {split.isActive && (
        <div className={styles.splitNote}>
          <Text element="p" variant="bodySmall" color="secondary">
            <Trans i18nKey="dashboard.auto-grid.options.column-layout-active">
              Splits 2:1 when the section is wide enough and stacks in order when it is narrow. The column options below
              apply only when the split is inactive.
            </Trans>
          </Text>
        </div>
      )}
      {split.columnLayout && !split.isActive && (
        <Alert
          severity="info"
          title={t('dashboard.auto-grid.options.column-layout-inactive-title', 'Split is inactive')}
          topSpacing={1}
          bottomSpacing={0}
        >
          <Stack direction="column" alignItems="flex-start" gap={1}>
            {split.inactiveReason === 'repeat'
              ? t(
                  'dashboard.auto-grid.options.column-layout-inactive-repeat',
                  'A repeated panel can produce any number of items, so the regular column options apply. The split returns when the repeat is removed.'
                )
              : t(
                  'dashboard.auto-grid.options.column-layout-inactive-count',
                  'The split needs exactly two panels; this grid has {{panelCount}}. The regular column options apply until it has two again.',
                  { panelCount: children.length }
                )}
            <Button
              size="sm"
              variant="secondary"
              fill="outline"
              onClick={() => changeAutoGridColumnLayout(layoutManager, undefined)}
              data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.resetColumnLayout}
            >
              <Trans i18nKey="dashboard.auto-grid.options.column-layout-reset">Reset to even</Trans>
            </Button>
          </Stack>
        </Alert>
      )}
    </div>
  );
}

function GridLayoutColumns({ layoutManager }: { layoutManager: AutoGridLayoutManager }) {
  const { maxColumnCount, columnWidth } = layoutManager.useState();
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [customMinWidthError, setCustomMinWidthError] = React.useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

  useSyncUncontrolledInput(inputRef, typeof columnWidth === 'number' ? columnWidth : undefined);
  // Undo/redo can replace an invalid entry without a blur, so its error has to go with it.
  useEffect(() => setCustomMinWidthError(false), [columnWidth]);

  const minWidthOptions: Array<ComboboxOption<AutoGridColumnWidth>> = [
    'narrow' as const,
    'standard' as const,
    'wide' as const,
    'custom' as const,
  ].map((value) => ({
    label: capitalize(value),
    value,
  }));

  const isStandardMinWidth = typeof columnWidth === 'string';

  const minWidthLabel = isStandardMinWidth
    ? t('dashboard.auto-grid.options.min-width', 'Min column width')
    : t('dashboard.auto-grid.options.min-width-custom', 'Custom min width');
  const colOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((value) => ({ label: value, value }));

  const onCustomMinWidthChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pixels = parseInt(e.target.value, 10);
    if (isNaN(pixels) || pixels < 50 || pixels > 2000) {
      setCustomMinWidthError(true);
      return;
    } else if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    if (pixels !== columnWidth) {
      changeAutoGridColumnWidth(layoutManager, pixels);
    }
  };

  const onNamedMinWidthChanged = (value: ComboboxOption<AutoGridColumnWidth>) => {
    if (value.value === 'custom') {
      setFocusInput(true);
    }
    changeAutoGridColumnWidth(layoutManager, value.value);
  };

  const onClearCustomMinWidth = () => {
    if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    changeAutoGridColumnWidth(layoutManager, 'standard');
  };

  return (
    // Fields use noMargin, so the group provides the bottom spacing that
    // separates it from the row options rendered below it in the pane.
    <div className={styles.optionGroup}>
      <Stack columnGap={2} rowGap={2} wrap>
        <Field
          label={minWidthLabel}
          invalid={customMinWidthError}
          error={
            customMinWidthError
              ? t('dashboard.auto-grid.options.min-width-error', 'A number between 50 and 2000 is required')
              : undefined
          }
          className={styles.wideSelector}
          noMargin
        >
          {isStandardMinWidth ? (
            <Combobox
              id="min-column-width"
              options={minWidthOptions}
              value={columnWidth}
              onChange={onNamedMinWidthChanged}
              data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth}
            />
          ) : (
            <Input
              id="min-column-width"
              defaultValue={columnWidth}
              onBlur={onCustomMinWidthChanged}
              ref={(ref) => {
                setInputRef(ref);
              }}
              type="number"
              min={50}
              max={2000}
              invalid={customMinWidthError}
              data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customMinColumnWidth}
              suffix={
                <Button
                  size="sm"
                  fill="text"
                  icon="times"
                  tooltip={t('dashboard.auto-grid.options.min-width-custom-clear', 'Back to standard min column width')}
                  onClick={onClearCustomMinWidth}
                  data-testid={
                    selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth
                  }
                >
                  {t('dashboard.auto-grid.options.custom-min-width.clear', 'Clear')}
                </Button>
              }
            />
          )}
        </Field>
        <Field
          label={t('dashboard.auto-grid.options.max-columns', 'Max columns')}
          className={styles.narrowSelector}
          noMargin
        >
          <Combobox
            id="max-columns"
            options={colOptions}
            value={String(maxColumnCount)}
            onChange={({ value }) => changeAutoGridMaxColumnCount(layoutManager, parseInt(value, 10))}
            width={6.5}
            data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns}
          />
        </Field>
      </Stack>
    </div>
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: AutoGridLayoutManager }) {
  const { rowHeight, fillScreen, fitContent, minHeight, maxHeightMode, maxHeight, matchRowHeights } =
    layoutManager.useState();
  const autoHeightPanelsEnabled = useFlagGrafanaDashboardsAutoHeightPanels();
  // Persisted fit state is ignored (not offered) while the feature toggle is off.
  const fitContentOn = autoHeightPanelsEnabled && !!fitContent;
  const matchRowHeightsOn = matchRowHeights !== false;
  const styles = useStyles2(getStyles);

  const namedHeightOptions: Array<ComboboxOption<AutoGridRowHeight>> = [
    'short' as const,
    'standard' as const,
    'tall' as const,
    'custom' as const,
  ].map((value) => ({
    label: capitalize(value),
    value,
  }));

  const minHeightOptions: Array<ComboboxOption<AutoGridMinHeight>> = [
    { label: t('dashboard.auto-grid.options.min-height-none', 'None'), value: 'none' as const },
    { label: t('dashboard.auto-grid.options.min-height-short', 'Short'), value: 'short' as const },
    { label: t('dashboard.auto-grid.options.min-height-standard', 'Standard'), value: 'standard' as const },
    { label: t('dashboard.auto-grid.options.min-height-tall', 'Tall'), value: 'tall' as const },
    { label: t('dashboard.auto-grid.options.min-height-custom-option', 'Custom'), value: 'custom' as const },
  ];

  const maxHeightOptions: Array<ComboboxOption<AutoGridMaxHeightMode>> = [
    { label: t('dashboard.auto-grid.options.max-height-unlimited', 'Unlimited'), value: 'unlimited' as const },
    { label: t('dashboard.auto-grid.options.max-height-short', 'Short'), value: 'short' as const },
    { label: t('dashboard.auto-grid.options.max-height-standard', 'Standard'), value: 'standard' as const },
    { label: t('dashboard.auto-grid.options.max-height-tall', 'Tall'), value: 'tall' as const },
    { label: t('dashboard.auto-grid.options.max-height-custom', 'Custom'), value: 'custom' as const },
  ];

  const minHeightValue = minHeight ?? 'standard';

  return (
    <Stack direction="column" gap={2}>
      {/* Base sizing: row height plus the two (mutually exclusive) grow modes. */}
      <Stack columnGap={2} rowGap={2} wrap>
        <NamedOrCustomSizeField
          id="min-height"
          label={t('dashboard.auto-grid.options.row-height', 'Row height')}
          customLabel={t('dashboard.auto-grid.options.row-height-custom', 'Custom row height')}
          className={styles.wideSelector}
          isCustom={typeof rowHeight === 'number'}
          value={rowHeight}
          options={namedHeightOptions}
          onModeChange={(value) => changeAutoGridRowHeight(layoutManager, value)}
          customValue={typeof rowHeight === 'number' ? rowHeight : undefined}
          min={50}
          max={2000}
          errorText={t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')}
          onCustomChange={(pixels) => changeAutoGridRowHeight(layoutManager, pixels)}
          clearTooltip={t('dashboard.auto-grid.options.row-height-custom-clear', 'Back to standard row height')}
          clearLabel={t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
          onClear={() => changeAutoGridRowHeight(layoutManager, 'standard')}
          comboboxTestId={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight}
          inputTestId={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight}
          clearTestId={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight}
        />
        {!fitContentOn && (
          <Field
            label={t('dashboard.auto-grid.options.height-fill', 'Fill screen')}
            className={styles.narrowSelector}
            noMargin
          >
            <InlineSwitch
              id="fill-screen-toggle"
              value={fillScreen}
              onChange={() => changeAutoGridFillScreen(layoutManager, !fillScreen)}
              data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen}
            />
          </Field>
        )}
        {autoHeightPanelsEnabled && !fillScreen && (
          <Field
            label={t('dashboard.auto-grid.options.fit-content', 'Auto fit')}
            className={styles.narrowSelector}
            noMargin
          >
            <InlineSwitch
              id="fit-content-toggle"
              value={fitContentOn}
              onChange={() => changeAutoGridFitContent(layoutManager, !fitContent)}
            />
          </Field>
        )}
      </Stack>
      {/* Content-fit bounds, only relevant while fit is on. */}
      {fitContentOn && (
        <Stack columnGap={2} rowGap={2} wrap>
          <NamedOrCustomSizeField
            id="fit-min-height"
            label={t('dashboard.auto-grid.options.min-height', 'Min height')}
            customLabel={t('dashboard.auto-grid.options.min-height-custom', 'Custom min height')}
            className={styles.wideSelector}
            isCustom={typeof minHeightValue === 'number'}
            value={minHeightValue}
            options={minHeightOptions}
            onModeChange={(value) => changeAutoGridMinHeight(layoutManager, value)}
            customValue={typeof minHeightValue === 'number' ? minHeightValue : undefined}
            min={50}
            max={2000}
            errorText={t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')}
            onCustomChange={(pixels) => changeAutoGridMinHeight(layoutManager, pixels)}
            clearTooltip={t('dashboard.auto-grid.options.min-height-custom-clear', 'Back to standard min height')}
            clearLabel={t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
            onClear={() => changeAutoGridMinHeight(layoutManager, 'standard')}
          />
          <NamedOrCustomSizeField
            id="max-height"
            label={t('dashboard.auto-grid.options.max-height', 'Max height')}
            customLabel={t('dashboard.auto-grid.options.max-height-custom-label', 'Custom max height')}
            className={styles.wideSelector}
            isCustom={maxHeightMode === 'custom'}
            value={maxHeightMode ?? 'unlimited'}
            options={maxHeightOptions}
            onModeChange={(value) => changeAutoGridMaxHeightMode(layoutManager, value)}
            customValue={maxHeight}
            min={50}
            max={10000}
            errorText={t('dashboard.auto-grid.options.max-height-error', 'A number between 50 and 10000 is required')}
            onCustomChange={(pixels) => changeAutoGridMaxHeightCustom(layoutManager, pixels)}
            clearTooltip={t('dashboard.auto-grid.options.max-height-clear', 'Back to unlimited')}
            clearLabel={t('dashboard.auto-grid.options.max-height-clear-label', 'Clear')}
            onClear={() => changeAutoGridMaxHeightMode(layoutManager, 'unlimited')}
          />
          <Field
            label={t('dashboard.auto-grid.options.match-row-heights', 'Match row heights')}
            className={styles.narrowSelector}
            noMargin
          >
            <InlineSwitch
              id="match-row-heights-toggle"
              value={matchRowHeightsOn}
              onChange={() => changeAutoGridMatchRowHeights(layoutManager, !matchRowHeightsOn)}
            />
          </Field>
        </Stack>
      )}
    </Stack>
  );
}

interface NamedOrCustomSizeFieldProps<T extends string | number> {
  id: string;
  /** Field label while a named size is selected */
  label: string;
  /** Field label while the custom pixel input is shown */
  customLabel: string;
  className?: string;
  /** When true the pixel input is rendered instead of the named-size combobox */
  isCustom: boolean;
  value: T;
  options: Array<ComboboxOption<T>>;
  onModeChange: (value: T) => void;
  customValue: number | undefined;
  min: number;
  max: number;
  errorText: string;
  onCustomChange: (pixels: number) => void;
  clearTooltip: string;
  clearLabel: string;
  /** Invoked by the clear button to leave custom mode */
  onClear: () => void;
  comboboxTestId?: string;
  inputTestId?: string;
  clearTestId?: string;
}

/**
 * Shows values changed outside of the uncontrolled input (e.g. by undo/redo). Remounting the input instead
 * would swallow a click on its clear button when the blur before that click commits a new value.
 */
function useSyncUncontrolledInput(input: HTMLInputElement | null, value: number | undefined) {
  useEffect(() => {
    if (input && value !== undefined && input.ownerDocument.activeElement !== input) {
      input.value = String(value);
    }
  }, [input, value]);
}

/**
 * A size option that is either a named preset or a custom pixel value.
 * Selecting "custom" in the combobox swaps in a validated number input and
 * focuses it; the input's clear button returns to the preset mode.
 */
function NamedOrCustomSizeField<T extends string | number>({
  id,
  label,
  customLabel,
  className,
  isCustom,
  value,
  options,
  onModeChange,
  customValue,
  min,
  max,
  errorText,
  onCustomChange,
  clearTooltip,
  clearLabel,
  onClear,
  comboboxTestId,
  inputTestId,
  clearTestId,
}: NamedOrCustomSizeFieldProps<T>) {
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [error, setError] = React.useState(false);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

  useSyncUncontrolledInput(inputRef, customValue);
  // Undo/redo can replace an invalid entry without a blur, so its error has to go with it.
  useEffect(() => setError(false), [isCustom, customValue]);

  return (
    <Field
      label={isCustom ? customLabel : label}
      invalid={error}
      error={error ? errorText : undefined}
      className={className}
      noMargin
    >
      {isCustom ? (
        <Input
          id={id}
          defaultValue={customValue}
          onBlur={(e) => {
            const pixels = parseInt(e.currentTarget.value, 10);
            if (isNaN(pixels) || pixels < min || pixels > max) {
              setError(true);
              return;
            }
            setError(false);
            if (pixels !== customValue) {
              onCustomChange(pixels);
            }
          }}
          ref={(ref) => {
            setInputRef(ref);
          }}
          type="number"
          min={min}
          max={max}
          invalid={error}
          data-testid={inputTestId}
          suffix={
            <Button
              size="sm"
              fill="text"
              icon="times"
              tooltip={clearTooltip}
              onClick={() => {
                setError(false);
                onClear();
              }}
              data-testid={clearTestId}
            >
              {clearLabel}
            </Button>
          }
        />
      ) : (
        <Combobox
          id={id}
          options={options}
          value={value}
          onChange={(option) => {
            if (option.value === 'custom') {
              setFocusInput(true);
            }
            setError(false);
            onModeChange(option.value);
          }}
          data-testid={comboboxTestId}
        />
      )}
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  optionGroup: css({
    marginBottom: theme.spacing(2),
  }),
  wideSelector: css({
    minWidth: theme.spacing(14),
    flex: `1 1 ${theme.spacing(14)}`,
  }),
  narrowSelector: css({
    width: theme.spacing(10),
  }),
  splitNote: css({
    marginTop: theme.spacing(1),
  }),
});
