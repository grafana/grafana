import { useMemo } from 'react';

import { EditableDashboardElement, MultiSelectedEditableDashboardElement } from '../scene/types';

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
