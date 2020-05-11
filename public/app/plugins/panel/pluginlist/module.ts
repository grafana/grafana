import _ from 'lodash';
import { PanelCtrl } from '../../../features/panel/panel_ctrl';
import { auto, IScope } from 'angular';
import { ContextSrv } from '../../../core/services/context_srv';
import { CoreEvents } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

class PluginListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';
  static scrollable = true;

  pluginList: any[];
  viewModel: any;
  isAdmin: boolean;

  // Set and populate defaults
  panelDefaults = {};

  /** @ngInject */
  constructor($scope: IScope, $injector: auto.IInjectorService, contextSrv: ContextSrv) {
    super($scope, $injector);

    _.defaults(this.panel, this.panelDefaults);

    this.isAdmin = contextSrv.hasRole('Admin');
    this.pluginList = [];
    this.viewModel = [
      { header: 'Installed Apps', list: [], type: 'app' },
      { header: 'Installed Panels', list: [], type: 'panel' },
      { header: 'Installed Datasources', list: [], type: 'datasource' },
    ];

    this.update();
  }

  gotoPlugin(plugin: { id: any }, evt: any) {
    if (evt) {
      evt.stopPropagation();
    }
    this.$location.url(`plugins/${plugin.id}/edit`);
  }

  updateAvailable(plugin: any, $event: any) {
    $event.stopPropagation();
    $event.preventDefault();

    const modalScope = this.$scope.$new(true);
    modalScope.plugin = plugin;

    this.publishAppEvent(CoreEvents.showModal, {
      src: 'public/app/features/plugins/partials/update_instructions.html',
      scope: modalScope,
    });
  }

  update() {
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .get('api/plugins', { embedded: 0, core: 0 })
        .then(plugins => {
          this.pluginList = plugins;
          this.viewModel[0].list = _.filter(plugins, { type: 'app' });
          this.viewModel[1].list = _.filter(plugins, { type: 'panel' });
          this.viewModel[2].list = _.filter(plugins, { type: 'datasource' });

          for (const plugin of this.pluginList) {
            if (plugin.hasUpdate) {
              plugin.state = 'has-update';
            } else if (!plugin.enabled) {
              plugin.state = 'not-enabled';
            }
          }
        })
    );
  }
}

export { PluginListCtrl, PluginListCtrl as PanelCtrl };
