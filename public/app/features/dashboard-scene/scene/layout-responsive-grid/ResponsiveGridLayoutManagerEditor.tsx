import { capitalize } from 'lodash';
import React, { useEffect } from 'react';

import { Button, Combobox, ComboboxOption, Field, InlineSwitch, Input, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AutoGridColumnWidth, AutoGridRowHeight, AutoGridLayoutManager } from './ResponsiveGridLayoutManager';

export function getEditOptions(layoutManager: AutoGridLayoutManager): OptionsPaneItemDescriptor[] {
  const options: OptionsPaneItemDescriptor[] = [];

  options.push(
    new OptionsPaneItemDescriptor({
      title: 'Column options',
      skipField: true,
      render: () => <GridLayoutColumns layoutManager={layoutManager} />,
    })
  );

  options.push(
    new OptionsPaneItemDescriptor({
      title: 'Row height options',
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
    <Stack gap={2} justifyContent={'stretch'}>
      <Field
        label={minWidthLabel}
        invalid={customMinWidthError}
        error={
          customMinWidthError
            ? t('dashboard.auto-grid.options.min-width-error', 'A number between 50 and 2000 is required')
            : undefined
        }
      >
        {isStandardMinWidth ? (
          <Combobox options={minWidthOptions} value={columnWidth} onChange={onNamedMinWidthChanged} />
        ) : (
          <Input
            defaultValue={columnWidth}
            onBlur={onCustomMinWidthChanged}
            ref={(ref) => setInputRef(ref)}
            type="number"
            min={50}
            max={2000}
            invalid={customMinWidthError}
            suffix={
              <Button
                size="sm"
                fill="text"
                icon="times"
                tooltip={t('dashboard.auto-grid.options.min-width-custom-clear', 'Back to standard min column width')}
                onClick={onClearCustomMinWidth}
              >
                {t('dashboard.auto-grid.options.custom-min-width.clear', 'Clear')}
              </Button>
            }
          />
        )}
      </Field>
      <Field label={t('dashboard.auto-grid.options.max-columns', 'Max columns')}>
        <Combobox
          options={colOptions}
          value={String(maxColumnCount)}
          onChange={({ value }) => layoutManager.onMaxColumnCountChanged(parseInt(value, 10))}
        />
      </Field>
    </Stack>
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: AutoGridLayoutManager }) {
  const { rowHeight, fillScreen } = layoutManager.useState();
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [customMinWidthError, setCustomMinWidthError] = React.useState(false);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

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
  const rowHeightLabel = rowHeight
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
    <Stack gap={2} wrap={true}>
      <Field
        label={rowHeightLabel}
        invalid={customMinWidthError}
        error={
          customMinWidthError
            ? t('dashboard.auto-grid.options.min-height-error', 'A number between 50 and 2000 is required')
            : undefined
        }
      >
        {isStandardHeight ? (
          <Combobox options={minWidthOptions} value={rowHeight} onChange={onNamedMinHeightChanged} width={18} />
        ) : (
          <Input
            defaultValue={rowHeight}
            onBlur={onCustomHeightChanged}
            ref={(ref) => setInputRef(ref)}
            width={18}
            type="number"
            min={50}
            max={2000}
            invalid={customMinWidthError}
            suffix={
              <Button
                size="sm"
                fill="text"
                icon="times"
                tooltip={t('dashboard.auto-grid.options.min-width-custom-clear', 'Back to standard min column width')}
                onClick={onClearCustomRowHeight}
              >
                {t('dashboard.auto-grid.options.custom-min-height.clear', 'Clear')}
              </Button>
            }
          />
        )}
      </Field>
      <Field label={t('dashboard.auto-grid.options.height-fill', 'Fill screen')}>
        <InlineSwitch value={fillScreen} onChange={() => layoutManager.onFillScreenChanged(!fillScreen)} />
      </Field>
    </Stack>
  );
}
