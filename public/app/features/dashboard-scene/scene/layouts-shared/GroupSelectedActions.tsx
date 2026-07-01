import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AddButton } from '../../edit-pane/add-new/AddButton';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { type GroupTarget, type GroupingResult, isGroupableLayoutManager } from '../types/DashboardLayoutManager';

const DISABLED: GroupingResult = { enabled: false };

/**
 * Resolves the layout manager that owns the selection and can group it. Grouping is dispatched
 * through the {@link DashboardLayoutManager} interface so this view stays a leaf module — it does
 * not import the concrete grouping logic (which lives inside the layout-manager import cycle).
 */
function resolveGroupableManager(items: SceneObject[]) {
  if (items.length === 0) {
    return undefined;
  }

  let manager;

  try {
    manager = getLayoutManagerFor(items[0]);
  } catch {
    return undefined;
  }

  return isGroupableLayoutManager(manager) ? manager : undefined;
}

interface Props {
  items: SceneObject[];
}

export function GroupSelectedActions({ items }: Props) {
  const manager = resolveGroupableManager(items);
  const rowGrouping = manager?.canGroupSelectionInto(items, 'row') ?? DISABLED;
  const tabGrouping = manager?.canGroupSelectionInto(items, 'tab') ?? DISABLED;

  const group = (target: GroupTarget) => {
    manager?.groupSelectionInto(items, target);

    if (target === 'row') {
      DashboardInteractions.trackGroupRowClick();
    } else {
      DashboardInteractions.trackGroupTabClick();
    }
  };

  return (
    <Stack direction="column" gap={1}>
      <AddButton
        icon="list-ul"
        label={t('dashboard.edit-pane.group.into-row', 'Group into row')}
        disabled={!rowGrouping.enabled}
        tooltip={!rowGrouping.enabled ? rowGrouping.reason : undefined}
        onClick={() => group('row')}
      />
      <AddButton
        icon="layers"
        label={t('dashboard.edit-pane.group.into-tab', 'Group into tab')}
        disabled={!tabGrouping.enabled}
        tooltip={!tabGrouping.enabled ? tabGrouping.reason : undefined}
        onClick={() => group('tab')}
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
