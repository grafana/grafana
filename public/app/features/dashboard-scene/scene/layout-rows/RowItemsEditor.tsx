import { Checkbox } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { EditPaneHeader } from '../../edit-pane/EditPaneHeader';

import { RowItems } from './RowItems';

export function getEditOptions(model: RowItems): OptionsPaneCategoryDescriptor[] {
  const options = new OptionsPaneCategoryDescriptor({
    title: '',
    id: `ms-row-options-${model.key}`,
    isOpenable: false,
    renderTitle: () => (
      <EditPaneHeader
        title={t('dashboard.edit-pane.row.multi-select.title', '{{length}} rows selected', {
          length: model.getNumberOfRowsSelected(),
        })}
        onDelete={() => model.onDelete()}
      />
    ),
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.row.header.title', 'Row header'),
      render: () => <RowHeaderCheckboxMulti model={model} />,
    })
  );

  return [options];
}

function RowHeaderCheckboxMulti({ model }: { model: RowItems }) {
  const rows = model.getRows();

  let value = false;
  let indeterminate = false;

  for (let i = 0; i < rows.length; i++) {
    const { isHeaderHidden } = rows[i].useState();

    const prevElement = rows[i - 1];
    indeterminate = indeterminate || (prevElement && !!prevElement.state.isHeaderHidden !== !!isHeaderHidden);

    value = value || !!isHeaderHidden;
  }

  return (
    <Checkbox
      label={t('dashboard.edit-pane.row.header.hide', 'Hide')}
      value={value}
      indeterminate={indeterminate}
      onChange={() => model.onHeaderHiddenToggle(value, indeterminate)}
    />
  );
}
