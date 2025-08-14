import { t } from '@grafana/i18n';
import { Icon, Stack, Tooltip } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRendering,
  disabledText?: string
): OptionsPaneCategoryDescriptor {
  const title = t('dashboard.conditional-rendering.root.title', 'Show / hide rules');

  let conditionalRenderingToRender =
    conditionalRendering ??
    new ConditionalRendering({
      rootGroup: new ConditionalRenderingGroup({
        visibility: 'show',
        condition: 'and',
        value: [],
      }),
    });

  return new OptionsPaneCategoryDescriptor({
    title,
    disabledText: conditionalRendering
      ? undefined
      : (disabledText ??
        t(
          'dashboard.conditional-rendering-not-supported.item-type',
          'Conditional rendering not supported for this item type'
        )),
    id: 'conditional-rendering-options',
    renderTitle: () => (
      <Stack direction="row" gap={1} alignItems="center">
        <div>{title}</div>
        <Tooltip content={conditionalRenderingToRender.info}>
          <Icon name={!conditionalRenderingToRender.evaluate() ? 'eye-slash' : 'eye'} />
        </Tooltip>
      </Stack>
    ),
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      render: () => <conditionalRenderingToRender.Component model={conditionalRenderingToRender} />,
    })
  );
}
