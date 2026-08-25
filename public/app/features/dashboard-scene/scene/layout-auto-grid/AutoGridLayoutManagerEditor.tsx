import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaDashboardsAutoHeightPanels } from '@grafana/runtime/internal';
import { Button, Combobox, type ComboboxOption, Field, InlineSwitch, Input, Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
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

    layoutManager.onColumnWidthChanged(pixels);
  };

  const onNamedMinWidthChanged = (value: ComboboxOption<AutoGridColumnWidth>) => {
    if (value.value === 'custom') {
      setFocusInput(true);
    }
    layoutManager.onColumnWidthChanged(value.value);
  };

  const onClearCustomMinWidth = () => {
    if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onColumnWidthChanged('standard');
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
            onChange={({ value }) => layoutManager.onMaxColumnCountChanged(parseInt(value, 10))}
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
          onModeChange={(value) => layoutManager.onRowHeightChanged(value)}
          customValue={typeof rowHeight === 'number' ? rowHeight : undefined}
          min={50}
          max={2000}
          errorText={t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')}
          onCustomChange={(pixels) => layoutManager.onRowHeightChanged(pixels)}
          clearTooltip={t('dashboard.auto-grid.options.row-height-custom-clear', 'Back to standard row height')}
          clearLabel={t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
          onClear={() => layoutManager.onRowHeightChanged('standard')}
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
              onChange={() => layoutManager.onFillScreenChanged(!fillScreen)}
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
              onChange={() => layoutManager.onFitContentChanged(!fitContent)}
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
            onModeChange={(value) => layoutManager.onMinHeightChanged(value)}
            customValue={typeof minHeightValue === 'number' ? minHeightValue : undefined}
            min={50}
            max={2000}
            errorText={t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')}
            onCustomChange={(pixels) => layoutManager.onMinHeightChanged(pixels)}
            clearTooltip={t('dashboard.auto-grid.options.min-height-custom-clear', 'Back to standard min height')}
            clearLabel={t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
            onClear={() => layoutManager.onMinHeightChanged('standard')}
          />
          <NamedOrCustomSizeField
            id="max-height"
            label={t('dashboard.auto-grid.options.max-height', 'Max height')}
            customLabel={t('dashboard.auto-grid.options.max-height-custom-label', 'Custom max height')}
            className={styles.wideSelector}
            isCustom={maxHeightMode === 'custom'}
            value={maxHeightMode ?? 'unlimited'}
            options={maxHeightOptions}
            onModeChange={(value) => layoutManager.onMaxHeightModeChanged(value)}
            customValue={maxHeight}
            min={50}
            max={10000}
            errorText={t('dashboard.auto-grid.options.max-height-error', 'A number between 50 and 10000 is required')}
            onCustomChange={(pixels) => layoutManager.onMaxHeightCustomChanged(pixels)}
            clearTooltip={t('dashboard.auto-grid.options.max-height-clear', 'Back to unlimited')}
            clearLabel={t('dashboard.auto-grid.options.max-height-clear-label', 'Clear')}
            onClear={() => layoutManager.onMaxHeightModeChanged('unlimited')}
          />
          <Field
            label={t('dashboard.auto-grid.options.match-row-heights', 'Match row heights')}
            className={styles.narrowSelector}
            noMargin
          >
            <InlineSwitch
              id="match-row-heights-toggle"
              value={matchRowHeightsOn}
              onChange={() => layoutManager.onMatchRowHeightsChanged(!matchRowHeightsOn)}
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
            onCustomChange(pixels);
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
});
