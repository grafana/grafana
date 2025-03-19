import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { useConditionalRenderingEditor } from '../../conditional-rendering/ConditionalRenderingEditor';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export function getOptions(model: ResponsiveGridItem): OptionsPaneCategoryDescriptor {
  return useConditionalRenderingEditor(model.state.conditionalRendering)!;
}
