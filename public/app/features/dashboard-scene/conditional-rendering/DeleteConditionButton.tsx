import { IconButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ConditionalRenderingConditions } from './shared';

interface Props {
  model: ConditionalRenderingConditions;
}

export const DeleteConditionButton = ({ model }: Props) => (
  <IconButton
    aria-label={t('dashboard.conditional-rendering.delete-condition.label', 'Delete Condition')}
    name="trash-alt"
    onClick={() => model.onDelete()}
  />
);
