import * as tslib_1 from "tslib";
import _ from 'lodash';
import $ from 'jquery';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import config from 'app/core/config';
import { transformDataToTable } from './transformers';
import { tablePanelEditor } from './editor';
import { columnOptionsTab } from './column_options';
import { TableRenderer } from './renderer';
var TablePanelCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(TablePanelCtrl, _super);
    /** @ngInject */
    function TablePanelCtrl($scope, $injector, templateSrv, annotationsSrv, $sanitize, variableSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.annotationsSrv = annotationsSrv;
        _this.$sanitize = $sanitize;
        _this.variableSrv = variableSrv;
        _this.panelDefaults = {
            targets: [{}],
            transform: 'timeseries_to_columns',
            pageSize: null,
            showHeader: true,
            styles: [
                {
                    type: 'date',
                    pattern: 'Time',
                    alias: 'Time',
                    dateFormat: 'YYYY-MM-DD HH:mm:ss',
                },
                {
                    unit: 'short',
                    type: 'number',
                    alias: '',
                    decimals: 2,
                    colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
                    colorMode: null,
                    pattern: '/.*/',
                    thresholds: [],
                },
            ],
            columns: [],
            scroll: true,
            fontSize: '100%',
            sort: { col: 0, desc: true },
        };
        _this.pageIndex = 0;
        if (_this.panel.styles === void 0) {
            _this.panel.styles = _this.panel.columns;
            _this.panel.columns = _this.panel.fields;
            delete _this.panel.columns;
            delete _this.panel.fields;
        }
        _.defaults(_this.panel, _this.panelDefaults);
        _this.events.on('data-received', _this.onDataReceived.bind(_this));
        _this.events.on('data-error', _this.onDataError.bind(_this));
        _this.events.on('data-snapshot-load', _this.onDataReceived.bind(_this));
        _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
        _this.events.on('init-panel-actions', _this.onInitPanelActions.bind(_this));
        return _this;
    }
    TablePanelCtrl.prototype.onInitEditMode = function () {
        this.addEditorTab('Options', tablePanelEditor, 2);
        this.addEditorTab('Column Styles', columnOptionsTab, 3);
    };
    TablePanelCtrl.prototype.onInitPanelActions = function (actions) {
        actions.push({ text: 'Export CSV', click: 'ctrl.exportCsv()' });
    };
    TablePanelCtrl.prototype.issueQueries = function (datasource) {
        this.pageIndex = 0;
        if (this.panel.transform === 'annotations') {
            return this.annotationsSrv
                .getAnnotations({
                dashboard: this.dashboard,
                panel: this.panel,
                range: this.range,
            })
                .then(function (annotations) {
                return { data: annotations };
            });
        }
        return _super.prototype.issueQueries.call(this, datasource);
    };
    TablePanelCtrl.prototype.onDataError = function (err) {
        this.dataRaw = [];
        this.render();
    };
    TablePanelCtrl.prototype.onDataReceived = function (dataList) {
        this.dataRaw = dataList;
        this.pageIndex = 0;
        // automatically correct transform mode based on data
        if (this.dataRaw && this.dataRaw.length) {
            if (this.dataRaw[0].type === 'table') {
                this.panel.transform = 'table';
            }
            else {
                if (this.dataRaw[0].type === 'docs') {
                    this.panel.transform = 'json';
                }
                else {
                    if (this.panel.transform === 'table' || this.panel.transform === 'json') {
                        this.panel.transform = 'timeseries_to_rows';
                    }
                }
            }
        }
        this.render();
    };
    TablePanelCtrl.prototype.render = function () {
        this.table = transformDataToTable(this.dataRaw, this.panel);
        this.table.sort(this.panel.sort);
        this.renderer = new TableRenderer(this.panel, this.table, this.dashboard.isTimezoneUtc(), this.$sanitize, this.templateSrv, config.theme.type);
        return _super.prototype.render.call(this, this.table);
    };
    TablePanelCtrl.prototype.toggleColumnSort = function (col, colIndex) {
        // remove sort flag from current column
        if (this.table.columns[this.panel.sort.col]) {
            this.table.columns[this.panel.sort.col].sort = false;
        }
        if (this.panel.sort.col === colIndex) {
            if (this.panel.sort.desc) {
                this.panel.sort.desc = false;
            }
            else {
                this.panel.sort.col = null;
            }
        }
        else {
            this.panel.sort.col = colIndex;
            this.panel.sort.desc = true;
        }
        this.render();
    };
    TablePanelCtrl.prototype.exportCsv = function () {
        var scope = this.$scope.$new(true);
        scope.tableData = this.renderer.render_values();
        scope.panel = 'table';
        this.publishAppEvent('show-modal', {
            templateHtml: '<export-data-modal panel="panel" data="tableData"></export-data-modal>',
            scope: scope,
            modalClass: 'modal--narrow',
        });
    };
    TablePanelCtrl.prototype.link = function (scope, elem, attrs, ctrl) {
        var data;
        var panel = ctrl.panel;
        var pageCount = 0;
        function getTableHeight() {
            var panelHeight = ctrl.height;
            if (pageCount > 1) {
                panelHeight -= 26;
            }
            return panelHeight - 31 + 'px';
        }
        function appendTableRows(tbodyElem) {
            ctrl.renderer.setTable(data);
            tbodyElem.empty();
            tbodyElem.html(ctrl.renderer.render(ctrl.pageIndex));
        }
        function switchPage(e) {
            var el = $(e.currentTarget);
            ctrl.pageIndex = parseInt(el.text(), 10) - 1;
            renderPanel();
        }
        function appendPaginationControls(footerElem) {
            footerElem.empty();
            var pageSize = panel.pageSize || 100;
            pageCount = Math.ceil(data.rows.length / pageSize);
            if (pageCount === 1) {
                return;
            }
            var startPage = Math.max(ctrl.pageIndex - 3, 0);
            var endPage = Math.min(pageCount, startPage + 9);
            var paginationList = $('<ul></ul>');
            for (var i = startPage; i < endPage; i++) {
                var activeClass = i === ctrl.pageIndex ? 'active' : '';
                var pageLinkElem = $('<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i + 1) + '</a></li>');
                paginationList.append(pageLinkElem);
            }
            footerElem.append(paginationList);
        }
        function renderPanel() {
            var panelElem = elem.parents('.panel-content');
            var rootElem = elem.find('.table-panel-scroll');
            var tbodyElem = elem.find('tbody');
            var footerElem = elem.find('.table-panel-footer');
            elem.css({ 'font-size': panel.fontSize });
            panelElem.addClass('table-panel-content');
            appendTableRows(tbodyElem);
            appendPaginationControls(footerElem);
            rootElem.css({ 'max-height': panel.scroll ? getTableHeight() : '' });
        }
        // hook up link tooltips
        elem.tooltip({
            selector: '[data-link-tooltip]',
        });
        function addFilterClicked(e) {
            var filterData = $(e.currentTarget).data();
            var options = {
                datasource: panel.datasource,
                key: data.columns[filterData.column].text,
                value: data.rows[filterData.row][filterData.column],
                operator: filterData.operator,
            };
            ctrl.variableSrv.setAdhocFilter(options);
        }
        elem.on('click', '.table-panel-page-link', switchPage);
        elem.on('click', '.table-panel-filter-link', addFilterClicked);
        var unbindDestroy = scope.$on('$destroy', function () {
            elem.off('click', '.table-panel-page-link');
            elem.off('click', '.table-panel-filter-link');
            unbindDestroy();
        });
        ctrl.events.on('render', function (renderData) {
            data = renderData || data;
            if (data) {
                renderPanel();
            }
            ctrl.renderingCompleted();
        });
    };
    TablePanelCtrl.templateUrl = 'module.html';
    return TablePanelCtrl;
}(MetricsPanelCtrl));
export { TablePanelCtrl, TablePanelCtrl as PanelCtrl };
//# sourceMappingURL=module.js.map