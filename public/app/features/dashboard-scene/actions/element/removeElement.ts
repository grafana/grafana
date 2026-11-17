import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { dropPickedPanels } from '../../questions/questionSources';
import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface RemoveElementActionHelperProps {
  meta: DashboardActionMeta;
  removedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export function removeElement(props: RemoveElementActionHelperProps) {
  const { removedObject, source, perform, undo } = props;

  const typeName = getElementTypeName(removedObject);
  if (typeName === undefined) {
    throw new Error('Removed object is not an editable element');
  }

  // Removing a layout can detach `source` from the dashboard, so find the dashboard first.
  const root = source.getRoot();
  let restoreQuestions: (() => void) | undefined;

  edit({
    meta: props.meta,
    description: t('dashboard.edit-actions.remove', 'Remove {{typeName}}', { typeName }),
    removedObject,
    source,
    perform: () => {
      perform();
      restoreQuestions = dropPickedPanels(root, removedObject);
    },
    undo: () => {
      undo();
      restoreQuestions?.();
      restoreQuestions = undefined;
    },
  });
}
