import { css } from '@emotion/css';
import { useCallback } from 'react';

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
    renderTitle: () => <ConditionalRenderingEditor title={title} conditionalRendering={conditionalRendering} />,
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

interface ConditionalRenderingEditorProps {
  title: string;
  conditionalRendering: ConditionalRendering;
}

export const ConditionalRenderingEditor = ({ title, conditionalRendering }: ConditionalRenderingEditorProps) => {
  const styles = useStyles2(getStyles);

  const addData = useCallback(
    () => conditionalRendering.addItem(new ConditionalRenderingData({ value: true })),
    [conditionalRendering]
  );

  const addInterval = useCallback(
    () => conditionalRendering.addItem(new ConditionalRenderingInterval({ value: '7d' })),
    [conditionalRendering]
  );

  const addVariable = useCallback(
    () =>
      showConditionalRenderingVariableEditor(conditionalRendering, {
        onSave: (name: string, operator: VariableConditionValueOperator, value: string) => {
          conditionalRendering.addItem(new ConditionalRenderingVariable({ value: { name, operator, value } }));
        },
      }),
    [conditionalRendering]
  );

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" onClick={(evt) => evt.stopPropagation()}>
      <h6 className={styles.title}>{title}</h6>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item label={t('dashboard.conditional-rendering.add.data', 'Data')} onClick={addData} />
            <Menu.Item label={t('dashboard.conditional-rendering.add.interval', 'Interval')} onClick={addInterval} />
            <Menu.Item
              label={t('dashboard.conditional-rendering.add.variable', 'Variable value')}
              onClick={addVariable}
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
};

const getStyles = () => ({
  title: css({
    margin: 0,
  }),
});
