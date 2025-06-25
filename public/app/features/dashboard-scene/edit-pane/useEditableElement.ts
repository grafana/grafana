import { useMemo } from 'react';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { ElementSelection } from './ElementSelection';

export function useEditableElement(
  selection: ElementSelection | undefined,
  editPane: DashboardEditPane
): EditableDashboardElement | undefined {
  return useMemo(() => {
    if (!selection) {
      const dashboard = getDashboardSceneFor(editPane);
      return new ElementSelection([[dashboard.state.uid!, dashboard.getRef()]]).createSelectionElement();
    }

    return selection.createSelectionElement();
  }, [selection, editPane]);
}
