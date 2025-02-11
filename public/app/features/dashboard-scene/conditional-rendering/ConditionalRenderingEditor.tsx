import { useMemo } from 'react';

import { SceneObject } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';

export function useConditionalRenderingEditor(model: SceneObject): OptionsPaneCategoryDescriptor | null {
  const { $behaviors } = model.useState();

  const conditionalRendering = useMemo(
    () => $behaviors?.find((behavior) => behavior instanceof ConditionalRendering),
    [$behaviors]
  );

  return useMemo(() => {
    if (!conditionalRendering) {
      return null;
    }

    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.conditional-rendering.title', 'Conditional rendering options'),
      id: 'conditional-rendering-options',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.conditional-rendering.title', 'Conditional rendering options'),
        render: () => <conditionalRendering.Component model={conditionalRendering} />,
      })
    );
  }, [conditionalRendering]);
}
