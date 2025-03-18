import { Combobox, InlineField, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ResponsiveGridLayoutManager } from './ResponsiveGridLayoutManager';

export function getEditOptions(layoutManager: ResponsiveGridLayoutManager): OptionsPaneItemDescriptor[] {
  const options: OptionsPaneItemDescriptor[] = [];

  options.push(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.responsive-layout.options.columns', 'Columns'),
      render: () => <GridLayoutColumns layoutManager={layoutManager} />,
    })
  );

  options.push(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.responsive-layout.options.rows', 'Row height'),
      render: () => <GridLayoutRows layoutManager={layoutManager} />,
    })
  );

  return options;
}

function GridLayoutColumns({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { maxColumnCount, minColumnWidth } = layoutManager.useState();

  const colOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((value) => ({ label: value, value }));
  const minWidthOptions = ['64', '128', '256', '384', '512', '768', '1024'].map((value) => ({
    label: String(value),
    value,
  }));

  return (
    <Stack gap={1} wrap={true}>
      <InlineField label={t('dashboard.responsive-layout.options.max-columns', 'Max count')} labelWidth={12}>
        <Combobox
          options={colOptions}
          value={String(maxColumnCount)}
          onChange={({ value }) => layoutManager.onMaxColumnCountChanged(value)}
          width={'auto'}
          minWidth={7}
        />
      </InlineField>
      <InlineField
        label={t('dashboard.responsive-layout.options.min-width', 'Min width')}
        grow={true}
        tooltip={t(
          'dashboard.responsive-layout.options.min-width-tooltip',
          'Controls how narrow a column can be on smaller screens'
        )}
        labelWidth={13}
      >
        <Combobox
          options={minWidthOptions}
          value={minColumnWidth}
          onChange={({ value }) => layoutManager.onMinColumnWidthChanged(value)}
          width={'auto'}
          minWidth={7}
        />
      </InlineField>
    </Stack>
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { minRowHeight, maxRowHeight } = layoutManager.useState();

  const maxHeightOptions = ['auto', '64', '128', '256', '384', '512', '768', '1024'].map((value) => ({
    label: String(value),
    value,
  }));

  const minHeightOptions = ['128', '256', '384', '512', '768', '1024'].map((value) => ({
    label: String(value),
    value,
  }));

  return (
    <Stack gap={1} wrap={true}>
      <InlineField label={t('dashboard.responsive-layout.options.max-height', 'Max height')} labelWidth={12}>
        <Combobox
          options={maxHeightOptions}
          value={String(maxRowHeight)}
          onChange={({ value }) => layoutManager.onMaxRowHeightChanged(value)}
          width={'auto'}
          minWidth={7}
        />
      </InlineField>
      <InlineField
        label={t('dashboard.responsive-layout.options.min-height', 'Min height')}
        grow={true}
        labelWidth={13}
      >
        <Combobox
          options={minHeightOptions}
          value={minRowHeight}
          onChange={({ value }) => layoutManager.onMinRowHeightChanged(value)}
          width={'auto'}
          minWidth={7}
        />
      </InlineField>
    </Stack>
  );
}
