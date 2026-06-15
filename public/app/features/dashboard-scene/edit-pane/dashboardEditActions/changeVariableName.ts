/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import { makeEditAction } from './makeEditAction';

export const changeVariableName = makeEditAction<SceneVariable, 'name'>({
  description: t('dashboard.variable.name.action', 'Change variable name'),
  prop: 'name',
});
