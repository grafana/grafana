import { Icon, Stack, Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRendering
): OptionsPaneCategoryDescriptor | null {
  if (!conditionalRendering) {
    return null;
  }

  const title = t('dashboard.conditional-rendering.root.title', 'Show / hide rules');

  return new OptionsPaneCategoryDescriptor({
    title,
    id: 'conditional-rendering-options',
    renderTitle: () => (
      <Stack direction="row" gap={1} alignItems="center">
        <div>{title}</div>
        <Tooltip content={conditionalRendering.info}>
          <Icon name={!conditionalRendering.evaluate() ? 'eye-slash' : 'eye'} />
        </Tooltip>
      </Stack>
    ),
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      render: () => <conditionalRendering.Component model={conditionalRendering} />,
    })
  );
}
