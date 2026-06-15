/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';

import { type DashboardScene } from '../../scene/DashboardScene';

import { makeEditAction } from './makeEditAction';

export const changeDescription = makeEditAction<DashboardScene, 'description'>({
  description: t('dashboard.description.action', 'Change dashboard description'),
  prop: 'description',
});
