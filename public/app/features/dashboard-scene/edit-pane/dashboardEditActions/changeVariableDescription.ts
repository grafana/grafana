/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import { makeEditAction } from './makeEditAction';

export const changeVariableDescription = makeEditAction<SceneVariable, 'description'>({
  description: t('dashboard.variable.description.action', 'Change variable description'),
  prop: 'description',
});
