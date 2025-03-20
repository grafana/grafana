import { capitalize } from 'lodash';
import React, { useEffect } from 'react';

import { Button, Combobox, ComboboxOption, Field, InlineSwitch, Input, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  AutoGridMinColumnWidth,
  AutoGridMinRowHeight,
  ResponsiveGridLayoutManager,
} from './ResponsiveGridLayoutManager';

export function getEditOptions(layoutManager: ResponsiveGridLayoutManager): OptionsPaneItemDescriptor[] {
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

function GridLayoutColumns({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { maxColumnCount, minColumnWidth } = layoutManager.useState();
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [customMinWidthError, setCustomMinWidthError] = React.useState(false);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

  const minWidthOptions: Array<ComboboxOption<AutoGridMinColumnWidth>> = [
    'narrow' as const,
    'standard' as const,
    'wide' as const,
    'custom' as const,
  ].map((value) => ({
    label: capitalize(value),
    value,
  }));

  const isStandardMinWidth = typeof minColumnWidth === 'string';

  const minWidthLabel = isStandardMinWidth
    ? t('dashboard.responsive-layout.options.min-width', 'Min column width')
    : t('dashboard.responsive-layout.options.min-width-custom', 'Custom min width');
  const colOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((value) => ({ label: value, value }));

  const onCustomMinWidthChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pixels = parseInt(e.target.value, 10);
    if (isNaN(pixels) || pixels < 50 || pixels > 2000) {
      setCustomMinWidthError(true);
      return;
    } else if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onMinColumnWidthChanged(pixels);
  };

  const onNamedMinWidthChanged = (value: ComboboxOption<AutoGridMinColumnWidth>) => {
    if (value.value === 'custom') {
      setFocusInput(true);
    }
    layoutManager.onMinColumnWidthChanged(value.value);
  };

  const onClearCustomMinWidth = () => {
    if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onMinColumnWidthChanged('standard');
  };

  return (
    <Stack gap={2} justifyContent={'stretch'}>
      <Field
        label={minWidthLabel}
        invalid={customMinWidthError}
        error={
          customMinWidthError
            ? t('dashboard.responsive-layout.options.min-width-error', 'A number between 50 and 2000 is required')
            : undefined
        }
      >
        {isStandardMinWidth ? (
          <Combobox options={minWidthOptions} value={minColumnWidth} onChange={onNamedMinWidthChanged} />
        ) : (
          <Input
            defaultValue={minColumnWidth}
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
                tooltip={t(
                  'dashboard.responsive-layout.options.min-width-custom-clear',
                  'Back to standard min column width'
                )}
                onClick={onClearCustomMinWidth}
              >
                Clear
              </Button>
            }
          />
        )}
      </Field>
      <Field label={t('dashboard.responsive-layout.options.max-columns', 'Max columns')}>
        <Combobox
          options={colOptions}
          value={String(maxColumnCount)}
          onChange={({ value }) => layoutManager.onMaxColumnCountChanged(value)}
        />
      </Field>
    </Stack>
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { minRowHeight, heightFill } = layoutManager.useState();
  const [inputRef, setInputRef] = React.useState<HTMLInputElement | null>(null);
  const [focusInput, setFocusInput] = React.useState(false);
  const [customMinWidthError, setCustomMinWidthError] = React.useState(false);

  useEffect(() => {
    if (focusInput && inputRef) {
      inputRef.focus();
      setFocusInput(false);
    }
  }, [focusInput, inputRef]);

  const minWidthOptions: Array<ComboboxOption<AutoGridMinRowHeight>> = [
    'short' as const,
    'standard' as const,
    'tall' as const,
    'custom' as const,
  ].map((value) => ({
    label: capitalize(value),
    value,
  }));

  const isStandardHeight = typeof minRowHeight === 'string';
  const rowHeightLabel = minRowHeight
    ? t('dashboard.responsive-layout.options.min-height', 'Row height')
    : t('dashboard.responsive-layout.options.min-height-custom', 'Custom row height');

  const onCustomHeightChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pixels = parseInt(e.target.value, 10);
    if (isNaN(pixels) || pixels < 50 || pixels > 2000) {
      setCustomMinWidthError(true);
      return;
    } else if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onMinRowHeightChanged(pixels);
  };

  const onNamedMinHeightChanged = (value: ComboboxOption<AutoGridMinRowHeight>) => {
    if (value.value === 'custom') {
      setFocusInput(true);
    }
    layoutManager.onMinRowHeightChanged(value.value);
  };

  const onClearCustomRowHeight = () => {
    if (customMinWidthError) {
      setCustomMinWidthError(false);
    }

    layoutManager.onMinRowHeightChanged('standard');
  };

  return (
    <Stack gap={2} wrap={true}>
      <Field
        label={rowHeightLabel}
        invalid={customMinWidthError}
        error={
          customMinWidthError
            ? t('dashboard.responsive-layout.options.min-height-error', 'A number between 50 and 2000 is required')
            : undefined
        }
      >
        {isStandardHeight ? (
          <Combobox options={minWidthOptions} value={minRowHeight} onChange={onNamedMinHeightChanged} width={18} />
        ) : (
          <Input
            defaultValue={minRowHeight}
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
                tooltip={t(
                  'dashboard.responsive-layout.options.min-width-custom-clear',
                  'Back to standard min column width'
                )}
                onClick={onClearCustomRowHeight}
              >
                Clear
              </Button>
            }
          />
        )}
      </Field>
      <Field label={t('dashboard.responsive-layout.options.height-fill', 'Fill screen')}>
        <InlineSwitch value={heightFill} onChange={() => layoutManager.onHeightFillChanged(!heightFill)} />
      </Field>
    </Stack>
  );
}
