/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import {
  dropShadowedPredefinedVariables,
  restoreUnshadowedPredefinedVariables,
  restoreVariableSetSnapshots,
  snapshotVariableSetsAlongPath,
} from '../../settings/variables/utils';
import { edit } from '../utils/edit';
import { type EditActionProps } from '../utils/types';

export function changeVariableName({ source, oldValue, newValue }: EditActionProps<SceneVariable, 'name'>) {
  // Snapshot set + ancestors before mutate so undo restores drops and re-injections.
  const snapshots = snapshotVariableSetsAlongPath(source);

  edit({
    description: t('dashboard.edit-actions.variable-name', 'Change variable name'),
    source,
    perform: () => {
      source.setState({ name: newValue });
      restoreUnshadowedPredefinedVariables(source);
      dropShadowedPredefinedVariables(source, newValue);
    },
    undo: () => {
      source.setState({ name: oldValue });
      restoreVariableSetSnapshots(snapshots);
    },
  });
}
