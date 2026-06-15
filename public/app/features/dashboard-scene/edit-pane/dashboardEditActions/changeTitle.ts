/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';

import { type DashboardScene } from '../../scene/DashboardScene';

import { makeEditAction } from './makeEditAction';

export const changeTitle = makeEditAction<DashboardScene, 'title'>({
  description: t('dashboard.title.action', 'Change dashboard title'),
  prop: 'title',
});
