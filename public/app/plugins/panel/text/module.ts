///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {PanelCtrl} from 'app/plugins/sdk';

 // Set and populate defaults
var panelDefaults = {
  mode    : "markdown", // 'html', 'markdown', 'text'
  content : "# title",
};

export class TextPanelCtrl extends PanelCtrl {
  static templateUrl = `public/app/plugins/panel/text/module.html`;

  converter: any;
  content: string;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv, private $sce) {
    super($scope, $injector);

    _.defaults(this.panel, panelDefaults);
  }

  initEditMode() {
    super.initEditMode();
    this.icon = 'fa fa-text-width';
    this.addEditorTab('Options', 'public/app/plugins/panel/text/editor.html');
    this.editorTabIndex = 1;
  }

  refresh() {
    this.render();
  }

  render() {
    if (this.panel.mode === 'markdown') {
      this.renderMarkdown(this.panel.content);
    } else if (this.panel.mode === 'html') {
      this.updateContent(this.panel.content);
    } else if (this.panel.mode === 'text') {
      this.renderText(this.panel.content);
    }
    this.renderingCompleted();
  }

  renderText(content) {
    content = content
    .replace(/&/g, '&amp;')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
    .replace(/\n/g, '<br/>');
    this.updateContent(content);
  }

  renderMarkdown(content) {
    var text = content
    .replace(/&/g, '&amp;')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;');

    if (this.converter) {
      this.updateContent(this.converter.makeHtml(text));
    } else {
      System.import('vendor/showdown').then(Showdown => {
        this.converter = new Showdown.converter();
        this.$scope.$apply(() => {
          this.updateContent(this.converter.makeHtml(text));
        });
      });
    }
  }

  updateContent(html) {
    try {
      this.content = this.$sce.trustAsHtml(this.templateSrv.replace(html, this.panel.scopedVars));
    } catch (e) {
      console.log('Text panel error: ', e);
      this.content = this.$sce.trustAsHtml(html);
    }
  }
}

export {TextPanelCtrl as PanelCtrl}
