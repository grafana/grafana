import * as tslib_1 from "tslib";
import _ from 'lodash';
import { PanelCtrl } from 'app/plugins/sdk';
import Remarkable from 'remarkable';
import { sanitize } from 'app/core/utils/text';
import config from 'app/core/config';
var defaultContent = "\n# Title\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n\n\n";
var TextPanelCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(TextPanelCtrl, _super);
    /** @ngInject */
    function TextPanelCtrl($scope, $injector, templateSrv, $sce) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.templateSrv = templateSrv;
        _this.$sce = $sce;
        // Set and populate defaults
        _this.panelDefaults = {
            mode: 'markdown',
            content: defaultContent,
        };
        _.defaults(_this.panel, _this.panelDefaults);
        _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
        _this.events.on('refresh', _this.onRefresh.bind(_this));
        _this.events.on('render', _this.onRender.bind(_this));
        var renderWhenChanged = function (scope) {
            var panel = scope.ctrl.panel;
            return [panel.content, panel.mode].join();
        };
        $scope.$watch(renderWhenChanged, _.throttle(function () {
            _this.render();
        }, 100));
        return _this;
    }
    TextPanelCtrl.prototype.onInitEditMode = function () {
        this.addEditorTab('Options', 'public/app/plugins/panel/text/editor.html');
        if (this.panel.mode === 'text') {
            this.panel.mode = 'markdown';
        }
    };
    TextPanelCtrl.prototype.onRefresh = function () {
        this.render();
    };
    TextPanelCtrl.prototype.onRender = function () {
        if (this.panel.mode === 'markdown') {
            this.renderMarkdown(this.panel.content);
        }
        else if (this.panel.mode === 'html') {
            this.updateContent(this.panel.content);
        }
        this.renderingCompleted();
    };
    TextPanelCtrl.prototype.renderText = function (content) {
        content = content
            .replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/\n/g, '<br/>');
        this.updateContent(content);
    };
    TextPanelCtrl.prototype.renderMarkdown = function (content) {
        var _this = this;
        if (!this.remarkable) {
            this.remarkable = new Remarkable();
        }
        this.$scope.$applyAsync(function () {
            _this.updateContent(_this.remarkable.render(content));
        });
    };
    TextPanelCtrl.prototype.updateContent = function (html) {
        html = config.disableSanitizeHtml ? html : sanitize(html);
        try {
            this.content = this.$sce.trustAsHtml(this.templateSrv.replace(html, this.panel.scopedVars));
        }
        catch (e) {
            console.log('Text panel error: ', e);
            this.content = this.$sce.trustAsHtml(html);
        }
    };
    TextPanelCtrl.templateUrl = "public/app/plugins/panel/text/module.html";
    TextPanelCtrl.scrollable = true;
    return TextPanelCtrl;
}(PanelCtrl));
export { TextPanelCtrl };
export { TextPanelCtrl as PanelCtrl };
//# sourceMappingURL=module.js.map