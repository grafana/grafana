import { useMemo } from 'react';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

import { ElementSelection } from './ElementSelection';

export function useEditableElement(
  selection: ElementSelection | undefined
): EditableDashboardElement | MultiSelectedEditableDashboardElement | undefined {
  return useMemo(() => {
    if (!selection) {
      return undefined;
    }

    return selection.createSelectionElement();
  }, [selection]);
}
