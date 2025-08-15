import { v4 as uuidv4 } from 'uuid';

import { t } from '@grafana/i18n';
import { Icon, Stack, Tooltip } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';

let placeholderConditionalRendering: ConditionalRendering | undefined;
function getPlaceholderConditionalRendering(): ConditionalRendering {
  if (!placeholderConditionalRendering) {
    placeholderConditionalRendering = new ConditionalRendering({
      rootGroup: new ConditionalRenderingGroup({
        visibility: 'show',
        condition: 'and',
        value: [],
      }),
    });
  }
  return placeholderConditionalRendering;
}

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRendering,
  disabledText?: string
): OptionsPaneCategoryDescriptor {
  const title = t('dashboard.conditional-rendering.root.title', 'Show / hide rules');

  const conditionalRenderingToRender = conditionalRendering ?? getPlaceholderConditionalRendering();

  return new OptionsPaneCategoryDescriptor({
    title,
    disabledText: conditionalRendering
      ? undefined
      : (disabledText ??
        t(
          'dashboard.conditional-rendering.editor.unsupported-item-type',
          'Conditional rendering not supported for this item type'
        )),
    id: 'conditional-rendering-options',
    renderTitle: () => (
      <Stack direction="row" gap={1} alignItems="center">
        <div>{title}</div>
        {conditionalRendering ? (
          <Tooltip content={conditionalRenderingToRender.info}>
            <Icon name={!conditionalRenderingToRender.evaluate() ? 'eye-slash' : 'eye'} />
          </Tooltip>
        ) : (
          <Icon name="eye-slash" />
        )}
      </Stack>
    ),
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      id: uuidv4(),
      render: () => <conditionalRenderingToRender.Component model={conditionalRenderingToRender} />,
    })
  );
}
