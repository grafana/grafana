/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';

import { makeEditAction } from './makeEditAction';

export const changeVariableLabel = makeEditAction<SceneVariable, 'label'>({
  description: t('dashboard.variable.label.action', 'Change variable label'),
  prop: 'label',
});
