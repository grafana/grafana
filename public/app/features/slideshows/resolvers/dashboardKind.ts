import { t } from '@grafana/i18n';
import { type PlaylistItemKind } from '@grafana/runtime';

import { getGrafanaSearcher } from '../../search/service/searcher';

export const dashboardKind: PlaylistItemKind = {
  group: 'dashboard.grafana.app',
  resource: 'dashboards',
  get title() {
    return t('slideshows.kinds.dashboards', 'Dashboards');
  },
  icon: 'apps',

  async resolve(uid) {
    // The search service already returns the slugged /d/<uid>/<slug> url and only returns
    // dashboards the viewer can see.
    const res = await getGrafanaSearcher().search({ query: '*', kind: ['dashboard'], uid: [uid], limit: 1 });
    const row = res.view.get(0);
    return row ? { url: row.url, title: row.name } : undefined;
  },

  async search(query, limit) {
    const res = await getGrafanaSearcher().search({ query: query || '*', kind: ['dashboard'], limit });
    return Array.from(res.view, (row) => ({ name: row.uid, title: row.name }));
  },
};
