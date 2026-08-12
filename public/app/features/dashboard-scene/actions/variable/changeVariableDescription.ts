/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import { makeEditAction } from '../utils/makeEditAction';

export const changeVariableDescription = makeEditAction<SceneVariable, 'description'>({
  description: t('dashboard.edit-actions.variable-description', 'Change variable description'),
  prop: 'description',
});
