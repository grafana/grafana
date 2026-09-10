/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import { makeEditAction } from '../utils/makeEditAction';

export const changeVariableLabel = makeEditAction<SceneVariable, 'label'>({
  description: t('dashboard.edit-actions.variable-label', 'Change variable label'),
  prop: 'label',
});
