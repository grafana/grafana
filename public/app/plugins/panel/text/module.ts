///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {PanelDirective, PanelCtrl} from '../../../features/panel/panel';

function optionsEditorTab() {
  return {templateUrl: 'public/app/plugins/panel/text/editor.html'};
}

 // Set and populate defaults
var panelDefaults = {
  mode    : "markdown", // 'html', 'markdown', 'text'
  content : "# title",
};

export class TextPanelCtrl extends PanelCtrl {
  converter: any;
  content: string;

  /** @ngInject */
  constructor($scope, private templateSrv, private $sce) {
    super($scope);

    _.defaults(this.panel, panelDefaults);
    this.render();
  }

  initEditorTabs() {
    super.initEditorTabs();
    this.editorTabs.push({title: 'Options', directiveFn: optionsEditorTab});
  }

  render() {
    if (this.panel.mode === 'markdown') {
      this.renderMarkdown(this.panel.content);
    } else if (this.panel.mode === 'html') {
      this.updateContent(this.panel.content);
    } else if (this.panel.mode === 'text') {
      this.renderText(this.panel.content);
    }
    // this.panelRenderingComplete();
  }

  refreshData() {
    this.render();
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
        this.updateContent(this.converter.makeHtml(text));
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

    if (!this.$scope.$$phase) {
      this.$scope.$digest();
    }
  }
}

class TextPanel extends PanelDirective {
  templateUrl = `app/plugins/panel/text/module.html`;
  controller = TextPanelCtrl;
}

export {TextPanel as Panel}
