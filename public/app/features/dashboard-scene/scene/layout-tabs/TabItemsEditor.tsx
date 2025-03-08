import { useMemo } from 'react';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { TabItems } from './TabItems';

export function getEditOptions(model: TabItems): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    //    const tabs = model.getTabs();
    return new OptionsPaneCategoryDescriptor({
      title: ``,
      id: '',
    });
  }, []);

  return [tabOptions];
}
