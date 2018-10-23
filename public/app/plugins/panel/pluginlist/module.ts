import _ from 'lodash';
import { PanelCtrl } from '../../../features/panel/panel_ctrl';

class PluginListCtrl extends PanelCtrl {
  static templateUrl = 'module.html';
  static scrollable = true;

  pluginList: any[];
  viewModel: any;

  // Set and populate defaults
  panelDefaults = {};

  /** @ngInject */
  constructor($scope, $injector, private backendSrv) {
    super($scope, $injector);

    _.defaults(this.panel, this.panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.pluginList = [];
    this.viewModel = [
      { header: 'Installed Apps', list: [], type: 'app' },
      { header: 'Installed Panels', list: [], type: 'panel' },
      { header: 'Installed Datasources', list: [], type: 'datasource' },
    ];

    this.update();
  }

  onInitEditMode() {
    this.editorTabIndex = 1;
    this.addEditorTab('Options', 'public/app/plugins/panel/pluginlist/editor.html');
  }

  gotoPlugin(plugin, evt) {
    if (evt) {
      evt.stopPropagation();
    }
    this.$location.url(`plugins/${plugin.id}/edit`);
  }

  updateAvailable(plugin, $event) {
    $event.stopPropagation();
    $event.preventDefault();

    const modalScope = this.$scope.$new(true);
    modalScope.plugin = plugin;

    this.publishAppEvent('show-modal', {
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
