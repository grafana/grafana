import { useMemo } from 'react';

import { EditableDashboardElement, MultiSelectedEditableDashboardElement } from '../scene/types';

import { ElementSelectionAdapter } from './ElementSelectionAdapter';

export function useEditableElement(
  selection: ElementSelectionAdapter | undefined
): EditableDashboardElement | MultiSelectedEditableDashboardElement | undefined {
  return useMemo(() => {
    if (!selection) {
      return undefined;
    }

    return selection.createSelectionElement();
  }, [selection]);
}
