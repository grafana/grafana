import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { Icon, Stack, Tooltip } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';

function protectedUseConditionalRenderingEditor(conditionalRendering: ConditionalRendering) {
  const { result } = conditionalRendering.useState();

  const title = t('dashboard.conditional-rendering.root.title', 'Show / hide rules');

  return new OptionsPaneCategoryDescriptor({
    title,
    id: 'conditional-rendering-options',
    renderTitle: () => (
      <Stack direction="row" gap={1} alignItems="center">
        <div>{title}</div>
        <Tooltip content={conditionalRendering.info}>
          <Icon name={!result ? 'eye-slash' : 'eye'} />
        </Tooltip>
      </Stack>
    ),
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      id: uuidv4(),
      render: () => <conditionalRendering.Component model={conditionalRendering} />,
    })
  );
}

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRendering
): OptionsPaneCategoryDescriptor | null {
  if (!conditionalRendering) {
    return null;
  }

  return protectedUseConditionalRenderingEditor(conditionalRendering);
}
