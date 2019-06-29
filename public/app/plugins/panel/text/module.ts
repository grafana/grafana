import _ from 'lodash';
import { PanelCtrl } from 'app/plugins/sdk';

import { sanitize, escapeHtml } from 'app/core/utils/text';
import config from 'app/core/config';
import { auto, ISCEService } from 'angular';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { renderMarkdown } from '@grafana/data';

const defaultContent = `
# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)



`;

export class TextPanelCtrl extends PanelCtrl {
  static templateUrl = `public/app/plugins/panel/text/module.html`;
  static scrollable = true;

  content: string;
  // Set and populate defaults
  panelDefaults = {
    mode: 'markdown', // 'html', 'markdown', 'text'
    content: defaultContent,
  };

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private templateSrv: TemplateSrv,
    private $sce: ISCEService
  ) {
    super($scope, $injector);

    _.defaults(this.panel, this.panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('render', this.onRender.bind(this));

    const renderWhenChanged = (scope: any) => {
      const { panel } = scope.ctrl;
      return [panel.content, panel.mode].join();
    };

    $scope.$watch(
      renderWhenChanged,
      _.throttle(() => {
        this.render();
      }, 100)
    );
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/app/plugins/panel/text/editor.html');

    if (this.panel.mode === 'text') {
      this.panel.mode = 'markdown';
    }
  }

  onRefresh() {
    this.render();
  }

  onRender() {
    if (this.panel.mode === 'markdown') {
      this.renderMarkdown(this.panel.content);
    } else if (this.panel.mode === 'html') {
      this.updateContent(this.panel.content);
    }
    this.renderingCompleted();
  }

  renderText(content: string) {
    const safeContent = escapeHtml(content).replace(/\n/g, '<br/>');
    this.updateContent(safeContent);
  }

  renderMarkdown(content: string) {
    this.$scope.$applyAsync(() => {
      this.updateContent(renderMarkdown(content));
    });
  }

  updateContent(html: string) {
    html = config.disableSanitizeHtml ? html : sanitize(html);
    try {
      this.content = this.$sce.trustAsHtml(this.templateSrv.replace(html, this.panel.scopedVars));
    } catch (e) {
      console.log('Text panel error: ', e);
      this.content = this.$sce.trustAsHtml(html);
    }
  }
}

export { TextPanelCtrl as PanelCtrl };
