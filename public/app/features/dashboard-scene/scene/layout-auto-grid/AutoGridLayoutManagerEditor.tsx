import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Combobox, type ComboboxOption, Field, InlineSwitch, Input, Stack, useStyles2 } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  type AutoGridColumnWidth,
  type AutoGridMaxHeightMode,
  type AutoGridRowHeight,
  type AutoGridLayoutManager,
} from './AutoGridLayoutManager';

export function getEditOptions(layoutManager: AutoGridLayoutManager): OptionsPaneItemDescriptor[] {
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
    <Stack columnGap={2} rowGap={0} wrap>
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
                data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomMinColumnWidth}
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
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: AutoGridLayoutManager }) {
  const { rowHeight, fillScreen, fitContent, maxHeightMode, maxHeight, matchRowHeights } = layoutManager.useState();
  const matchRowHeightsOn = matchRowHeights !== false;
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [maxHeightFocusInput, setMaxHeightFocusInput] = React.useState(false);
  const [maxHeightInputRef, setMaxHeightInputRef] = React.useState<HTMLInputElement | null>(null);
  const [customMinWidthError, setCustomMinWidthError] = React.useState(false);
  const [maxHeightError, setMaxHeightError] = React.useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

  useEffect(() => {
    if (maxHeightFocusInput && maxHeightInputRef) {
      maxHeightInputRef.focus();
      setMaxHeightFocusInput(false);
    }
  }, [maxHeightFocusInput, maxHeightInputRef]);

  const maxHeightOptions: Array<ComboboxOption<AutoGridMaxHeightMode>> = [
    { label: t('dashboard.auto-grid.options.max-height-unlimited', 'Unlimited'), value: 'unlimited' as const },
    { label: t('dashboard.auto-grid.options.max-height-short', 'Short'), value: 'short' as const },
    { label: t('dashboard.auto-grid.options.max-height-standard', 'Standard'), value: 'standard' as const },
    { label: t('dashboard.auto-grid.options.max-height-tall', 'Tall'), value: 'tall' as const },
    { label: t('dashboard.auto-grid.options.max-height-custom', 'Custom'), value: 'custom' as const },
    { label: t('dashboard.auto-grid.options.max-height-screen', 'Screen'), value: 'screen' as const },
  ];

  const minWidthOptions: Array<ComboboxOption<AutoGridRowHeight>> = [
    'short' as const,
    'standard' as const,
    'tall' as const,
    'custom' as const,
  ].map((value) => ({
    label: capitalize(value),
    value,
  }));

  const isStandardHeight = typeof rowHeight === 'string';
  const rowHeightLabel = fitContent
    ? t('dashboard.auto-grid.options.min-height-fit', 'Minimum height')
    : rowHeight
      ? t('dashboard.auto-grid.options.min-height', 'Row height')
      : t('dashboard.auto-grid.options.min-height-custom', 'Custom row height');

  const onCustomHeightChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pixels = parseInt(e.target.value, 10);
    if (isNaN(pixels) || pixels < 50 || pixels > 2000) {
      setCustomMinWidthError(true);
      return;
    } else if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onRowHeightChanged(pixels);
  };

  const onNamedMinHeightChanged = (value: ComboboxOption<AutoGridRowHeight>) => {
    if (value.value === 'custom') {
      setFocusInput(true);
    }
    layoutManager.onRowHeightChanged(value.value);
  };

  const onClearCustomRowHeight = () => {
    if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onRowHeightChanged('standard');
  };

  return (
    <Stack columnGap={2} rowGap={0} wrap>
      <Field
        label={rowHeightLabel}
        invalid={customMinWidthError}
        error={
          customMinWidthError
            ? t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')
            : undefined
        }
        className={styles.wideSelector}
        noMargin
      >
        {isStandardHeight ? (
          <Combobox
            id="min-height"
            options={minWidthOptions}
            value={rowHeight}
            onChange={onNamedMinHeightChanged}
            data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight}
          />
        ) : (
          <Input
            id="min-height"
            defaultValue={rowHeight}
            onBlur={onCustomHeightChanged}
            ref={(ref) => {
              setInputRef(ref);
            }}
            type="number"
            min={50}
            max={2000}
            invalid={customMinWidthError}
            data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight}
            suffix={
              <Button
                size="sm"
                fill="text"
                icon="times"
                tooltip={t('dashboard.auto-grid.options.min-width-custom-clear', 'Back to standard min column width')}
                onClick={onClearCustomRowHeight}
                data-testid={selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight}
              >
                {t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
              </Button>
            }
          />
        )}
      </Field>
      {!fitContent && (
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
      {fitContent && (
        <Field
          label={
            maxHeightMode === 'custom'
              ? t('dashboard.auto-grid.options.max-height-custom-label', 'Custom max height')
              : t('dashboard.auto-grid.options.max-height', 'Max height')
          }
          invalid={maxHeightError}
          error={
            maxHeightError
              ? t('dashboard.auto-grid.options.max-height-error', 'A number between 50 and 10000 is required')
              : undefined
          }
          className={styles.wideSelector}
          noMargin
        >
          {maxHeightMode === 'custom' ? (
            <Input
              id="max-height"
              defaultValue={maxHeight}
              onBlur={(e) => {
                const pixels = parseInt(e.target.value, 10);
                if (isNaN(pixels) || pixels < 50 || pixels > 10000) {
                  setMaxHeightError(true);
                  return;
                }
                setMaxHeightError(false);
                layoutManager.onMaxHeightCustomChanged(pixels);
              }}
              ref={(ref) => {
                setMaxHeightInputRef(ref);
              }}
              type="number"
              min={50}
              max={10000}
              invalid={maxHeightError}
              suffix={
                <Button
                  size="sm"
                  fill="text"
                  icon="times"
                  tooltip={t('dashboard.auto-grid.options.max-height-clear', 'Back to unlimited')}
                  onClick={() => {
                    setMaxHeightError(false);
                    layoutManager.onMaxHeightModeChanged('unlimited');
                  }}
                >
                  {t('dashboard.auto-grid.options.max-height-clear-label', 'Clear')}
                </Button>
              }
            />
          ) : (
            <Combobox
              id="max-height"
              options={maxHeightOptions}
              value={maxHeightMode ?? 'unlimited'}
              onChange={(option) => {
                if (option.value === 'custom') {
                  setMaxHeightFocusInput(true);
                }
                setMaxHeightError(false);
                layoutManager.onMaxHeightModeChanged(option.value);
              }}
            />
          )}
        </Field>
      )}
      <Field
        label={t('dashboard.auto-grid.options.fit-content', 'Auto fit content')}
        className={styles.narrowSelector}
        noMargin
      >
        <InlineSwitch
          id="fit-content-toggle"
          value={!!fitContent}
          onChange={() => layoutManager.onFitContentChanged(!fitContent)}
        />
      </Field>
      {fitContent && (
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
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wideSelector: css({
    minWidth: theme.spacing(14),
    flex: `1 1 ${theme.spacing(14)}`,
  }),
  narrowSelector: css({
    width: theme.spacing(10),
  }),
});
