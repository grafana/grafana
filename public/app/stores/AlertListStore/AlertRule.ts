import { types, getEnv, flow } from 'mobx-state-tree';
import { setStateFields } from './helpers';

export const AlertRule = types
  .model('AlertRule', {
    id: types.identifier(types.number),
    dashboardId: types.number,
    panelId: types.number,
    name: types.string,
    state: types.string,
    stateText: types.string,
    stateIcon: types.string,
    stateClass: types.string,
    stateAge: types.string,
    info: types.optional(types.string, ''),
    url: types.string,
  })
  .views(self => ({
    get isPaused() {
      return self.state === 'paused';
    },
  }))
  .actions(self => ({
    /**
     * will toggle alert rule paused state
     */
    togglePaused: flow(function* togglePaused() {
      const backendSrv = getEnv(self).backendSrv;
      const payload = { paused: !self.isPaused };
      const res = yield backendSrv.post(`/api/alerts/${self.id}/pause`, payload);
      setStateFields(self, res.state);
      self.info = '';
    }),
  }));
