import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AddButton } from '../../edit-pane/add-new/AddButton';
import { DashboardInteractions } from '../../utils/interactions';

import { canGroupSelection, groupSelectedInto } from './groupSelectedItems';

interface Props {
  items: SceneObject[];
}

export function GroupSelectedActions({ items }: Props) {
  const rowGrouping = canGroupSelection(items, 'row');
  const tabGrouping = canGroupSelection(items, 'tab');

  return (
    <Stack direction="column" gap={1}>
      <AddButton
        icon="list-ul"
        label={t('dashboard.edit-pane.group.into-row', 'Group into row')}
        disabled={!rowGrouping.enabled}
        tooltip={!rowGrouping.enabled ? rowGrouping.reason : undefined}
        onClick={() => {
          groupSelectedInto(items, 'row');
          DashboardInteractions.trackGroupRowClick();
        }}
      />
      <AddButton
        icon="layers"
        label={t('dashboard.edit-pane.group.into-tab', 'Group into tab')}
        disabled={!tabGrouping.enabled}
        tooltip={!tabGrouping.enabled ? tabGrouping.reason : undefined}
        onClick={() => {
          groupSelectedInto(items, 'tab');
          DashboardInteractions.trackGroupTabClick();
        }}
      />
    </Stack>
  );
}

export function getGroupSelectedCategory(items: SceneObject[]): OptionsPaneCategoryDescriptor {
  const id = 'group-selected-options';
  return new OptionsPaneCategoryDescriptor({
    title: t('dashboard.edit-pane.group.title', 'Group'),
    id,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title: '',
      id: `${id}-actions`,
      render: () => <GroupSelectedActions items={items} />,
    })
  );
}
