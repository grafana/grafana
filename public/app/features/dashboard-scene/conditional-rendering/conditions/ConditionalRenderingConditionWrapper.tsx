import { type ReactNode } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Icon, IconButton, Stack, Text, Tooltip } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardInteractions } from '../../utils/interactions';
import { type GroupConditionConditionType } from '../group/types';

import { type ConditionalRenderingConditions } from './types';
import { getConditionIndex, removeCondition, undoRemoveCondition } from './utils';

interface Props {
  children: ReactNode;
  info: string;
  isObjectSupported: boolean;
  model: ConditionalRenderingConditions;
  title: string;
  ruleId: GroupConditionConditionType;
}

export function ConditionalRenderingConditionWrapper({
  children,
  info,
  isObjectSupported,
  model,
  title,
  ruleId,
}: Props) {
  const onDeleteconditionalRenderingRule = () => {
    const index = getConditionIndex(model);
    DashboardInteractions.clickRemoveConditionalRuleButton({ ruleId });
    dashboardEditActions.edit({
      description: t('dashboard.conditional-rendering.conditions.wrapper.delete-condition', 'Delete Condition'),
      source: model,
      perform: () => removeCondition(model),
      undo: () => {
        if (index > -1) {
          undoRemoveCondition(model, index);
        }
      },
    });
  };
  return (
    <Stack direction="column" key={model.state.key!}>
      <Stack direction="row" gap={1}>
        <Text variant="bodySmall">{title}</Text>
        {info && (
          <Tooltip content={info}>
            <Icon name="info-circle" />
          </Tooltip>
        )}
      </Stack>

      <Stack direction="row" gap={1} justifyContent="stretch" alignItems="center">
        <Stack flex={1} direction="column" gap={1}>
          {children}
          {!isObjectSupported && (
            <Alert severity="error" title="">
              <Trans i18nKey="dashboard.conditional-rendering.conditions.wrapper.unsupported-object-type">
                This condition is not supported by the element, hence it will be ignored.
              </Trans>
            </Alert>
          )}
        </Stack>

        <IconButton
          aria-label={t('dashboard.conditional-rendering.conditions.wrapper.delete-condition', 'Delete Condition')}
          name="trash-alt"
          onClick={onDeleteconditionalRenderingRule}
        />
      </Stack>
    </Stack>
  );
}
