import _ from 'lodash';
import { PanelCtrl } from '../../../features/panel/panel_ctrl';
import { auto } from 'angular';
import { BackendSrv } from '@grafana/runtime';
import { PanelEvents } from '@grafana/data';
import { ContextSrv } from '../../../core/services/context_srv';
import { CoreEvents } from 'app/types';

class PluginListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';
  static scrollable = true;

  pluginList: any[];
  viewModel: any;
  isAdmin: boolean;

  // Set and populate defaults
  panelDefaults = {};

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService, private backendSrv: BackendSrv, contextSrv: ContextSrv) {
    super($scope, $injector);

    _.defaults(this.panel, this.panelDefaults);

    this.isAdmin = contextSrv.hasRole('Admin');
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
    this.pluginList = [];
    this.viewModel = [
      { header: 'Installed Apps', list: [], type: 'app' },
      { header: 'Installed Panels', list: [], type: 'panel' },
      { header: 'Installed Datasources', list: [], type: 'datasource' },
    ];

    this.update();
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/app/plugins/panel/pluginlist/editor.html');
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
    this.backendSrv.get('api/plugins', { embedded: 0, core: 0 }).then(plugins => {
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
    });
  }
}

export { PluginListCtrl, PluginListCtrl as PanelCtrl };
