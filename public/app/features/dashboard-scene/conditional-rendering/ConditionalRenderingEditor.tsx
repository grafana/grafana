import { css } from '@emotion/css';

import { Button, Dropdown, Menu, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ConditionalRendering } from './ConditionalRendering';
import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingInterval } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable, VariableConditionValueOperator } from './ConditionalRenderingVariable';
import { showConditionalRenderingVariableEditor } from './ConditionalRenderingVariableEditor';

export function useConditionalRenderingEditor(
  conditionalRendering?: ConditionalRendering
): OptionsPaneCategoryDescriptor | null {
  if (!conditionalRendering) {
    return null;
  }

  const title = t('dashboard.conditional-rendering.title', 'Display conditions');

  return new OptionsPaneCategoryDescriptor({
    renderTitle: () => {
      const styles = useStyles2(getStyles);

      return (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          onClick={(evt) => evt.stopPropagation()}
        >
          <h6 className={styles.title}>{title}</h6>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  label={t('dashboard.conditional-rendering.add.data', 'Data')}
                  onClick={() => conditionalRendering.addItem(new ConditionalRenderingData({ value: true }))}
                />
                <Menu.Item
                  label={t('dashboard.conditional-rendering.add.interval', 'Interval')}
                  onClick={() => conditionalRendering.addItem(new ConditionalRenderingInterval({ value: '7d' }))}
                />
                <Menu.Item
                  label={t('dashboard.conditional-rendering.add.variable', 'Variable value')}
                  onClick={() =>
                    showConditionalRenderingVariableEditor(conditionalRendering, {
                      onSave: (name: string, operator: VariableConditionValueOperator, value: string) => {
                        conditionalRendering.addItem(
                          new ConditionalRenderingVariable({ value: { name, operator, value } })
                        );
                      },
                    })
                  }
                />
              </Menu>
            }
          >
            <Button
              aria-label={t('dashboard.conditional-rendering.add.label', 'Add condition')}
              icon="plus"
              type="button"
              fill="text"
              size="md"
              variant="secondary"
              onPointerDown={(evt) => evt.stopPropagation()}
              onClick={(evt) => {
                evt.stopPropagation();
                evt.preventDefault();
              }}
            />
          </Dropdown>
        </Stack>
      );
    },
    isOpenDefault: true,
    forceOpen: 1,
    title,
    id: 'conditional-rendering-options',
  }).addItem(
    new OptionsPaneItemDescriptor({
      title,
      render: () => <conditionalRendering.Component model={conditionalRendering} />,
    })
  );
}

const getStyles = () => ({
  title: css({
    margin: 0,
  }),
});
