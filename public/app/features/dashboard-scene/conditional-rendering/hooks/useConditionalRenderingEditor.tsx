import { t } from '@grafana/i18n';
import { Icon, Stack, Tooltip } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';
import { getLowerTranslatedObjectType, getObjectType } from '../object';

let placeholderConditionalRendering: ConditionalRenderingGroup | undefined;

function getPlaceholderConditionalRendering(): ConditionalRenderingGroup {
  if (!placeholderConditionalRendering) {
    placeholderConditionalRendering = ConditionalRenderingGroup.createEmpty();
  }
  return placeholderConditionalRendering;
}

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRenderingGroup,
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
          'dashboard.conditional-rendering.editor.unsupported-object-type',
          'Conditional rendering not supported for this item type'
        )),
    id: 'conditional-rendering-options',
    renderTitle: () => {
      const { result } = conditionalRenderingToRender.useState();

      return (
        <Stack direction="row" gap={1} alignItems="center">
          <div>{title}</div>
          {conditionalRendering ? (
            <Tooltip
              content={t(
                'dashboard.conditional-rendering.editor.info',
                'Set rules to control {{type}} visibility by matching any or all rules.',
                { type: getLowerTranslatedObjectType(getObjectType(conditionalRenderingToRender.parent)) }
              )}
            >
              <Icon name={!result ? 'eye-slash' : 'eye'} />
            </Tooltip>
          ) : (
            <Icon name="eye-slash" />
          )}
        </Stack>
      );
    },
    isOpenDefault: true,
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      id: 'conditional-rendering-options-item',
      render: () => <conditionalRenderingToRender.Component model={conditionalRenderingToRender} />,
    })
  );
}
