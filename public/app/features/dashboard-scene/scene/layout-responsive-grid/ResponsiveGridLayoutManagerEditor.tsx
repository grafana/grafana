import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ResponsiveGridLayoutManager } from './ResponsiveGridLayoutManager';

const sizes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 650];

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
      title: t('dashboard.responsive-layout.options.rows', 'Rows'),
      render: () => <GridLayoutRows layoutManager={layoutManager} />,
    })
  );

  return options;
}

function GridLayoutColumns({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { templateColumns } = layoutManager.state.layout.useState();

  const colOptions: Array<SelectableValue<string>> = [
    { label: t('dashboard.responsive-layout.options.one-column', '1 column'), value: `1fr` },
    { label: t('dashboard.responsive-layout.options.two-columns', '2 columns'), value: `1fr 1fr` },
    { label: t('dashboard.responsive-layout.options.three-columns', '3 columns'), value: `1fr 1fr 1fr` },
  ];

  for (const size of sizes) {
    colOptions.push({
      label: t('dashboard.responsive-layout.options.min', 'Min: {{size}}px', { size }),
      value: `repeat(auto-fit, minmax(${size}px, auto))`,
    });
  }

  return (
    <Select
      options={colOptions}
      value={String(templateColumns)}
      onChange={({ value }) => layoutManager.changeColumns(value!)}
      allowCustomValue={true}
    />
  );
}

function GridLayoutRows({ layoutManager }: { layoutManager: ResponsiveGridLayoutManager }) {
  const { autoRows } = layoutManager.state.layout.useState();

  const rowOptions: Array<SelectableValue<string>> = [];

  for (const size of sizes) {
    rowOptions.push({
      label: t('dashboard.responsive-layout.options.min', 'Min: {{size}}px', { size }),
      value: `minmax(${size}px, auto)`,
    });
  }

  for (const size of sizes) {
    rowOptions.push({
      label: t('dashboard.responsive-layout.options.fixed', 'Fixed: {{size}}px', { size }),
      value: `${size}px`,
    });
  }

  return (
    <Select
      options={rowOptions}
      value={String(autoRows)}
      onChange={({ value }) => layoutManager.changeRows(value!)}
      allowCustomValue={true}
    />
  );
}
