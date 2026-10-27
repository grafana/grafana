import { t } from '@grafana/i18n';
import { type SceneObject, VizPanel } from '@grafana/scenes';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { type EditableDashboardElement } from '../../scene/types/EditableDashboardElement';
import { isSceneVariable } from '../../settings/variables/utils';
import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';
import { changeVariableName } from '../variable/changeVariableName';

interface RenameElementProps {
  source: SceneObject;
  element: EditableDashboardElement;
  oldName: string;
  newName: string;
}

const RENAME_SCOPE = 'outline';

export function renameElement({ source, element, oldName, newName }: RenameElementProps) {
  // Variable renames can drop/re-inject predefined variables, which only changeVariableName undoes exactly
  if (isSceneVariable(source)) {
    changeVariableName({ source, oldValue: oldName, newValue: newName, scope: RENAME_SCOPE });
    return;
  }

  edit({
    meta: { actionId: getRenameActionId(source), scope: RENAME_SCOPE },
    description: t('dashboard.edit-actions.rename', 'Rename {{typeName}}', {
      typeName: element.getEditableElementInfo().typeName,
    }),
    source,
    perform: () => element.onChangeName?.(newName),
    undo: () => element.onChangeName?.(oldName),
  });
}

function getRenameActionId(source: SceneObject): DashboardActionMeta['actionId'] {
  if (source instanceof VizPanel) {
    return 'panel.changeTitle';
  }

  if (source instanceof RowItem) {
    return 'row.changeTitle';
  }

  if (source instanceof TabItem) {
    return 'tab.changeTitle';
  }

  return 'element.rename';
}
