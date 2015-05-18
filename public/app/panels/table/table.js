define([
  'angular',
  'jquery',
  'lodash',
  'moment'
],
  function (angular, $, _, moment) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('grafanaTable', function($rootScope, $timeout, $sce) {
      var SortType = {
        none: 0,
        asc: 1,
        desc: 2
      };

      return {
        restrict: 'A',
        templateUrl: 'app/panels/table/table.html',
        link: function(scope, elem) {
          var data;
          var sortedData; // will shadow the data

          // paging variables
          var dataToSkip;
          var pagedData;
          var minPage;

          var tableHeight;

          scope.sortType = SortType;

          // refers to the actual physical column order of the table
          scope.columnOrder = [];

          // refers to the order in which the columns were requested to be sorted
          // for example, we might want to first sort by second column, then by third, then by first, etc.
          // this does not necessarily refer to the physical order of the columns
          scope.panel.columnSortOrder = [];

          scope.$on('render',function(event, renderData) {
            data = renderData || data;
            if (!data) {
              scope.get_data();
              return;
            }

            scope.columnOrder = data.columnOrder;
            sortedData = [].concat(data.values); // on initial render, original data is the desired sort
            setupInitialPaging();
            renderTable();
          });

          // if user changes page
          scope.$watch('panel.curTablePage', function() {
            scope.panel.curTablePage = parseInt(scope.panel.curTablePage) || 1; // ensure page is numeric

            if (scope.panel.curTablePage < minPage) {
              scope.panel.curTablePage = minPage;
            }

            if (scope.panel.curTablePage > scope.panel.numPages) {
              scope.panel.curTablePage = scope.panel.numPages;
            }

            if (!data) {
              return;
            }

            renderTable();
          });

          // if user tries to sort
          scope.headerClicked = function(header) {
            if (!scope.panel.allowSorting) {
              return;
            }

            changeSortType(header);
            handleSorting();
            renderTable();
          };

          scope.panel.clearSortOrder = function() {
            _.each(scope.headers, function(column) {
              column.sortType = SortType.none;
            });

            scope.panel.columnSortOrder = [];
            sortedData = [].concat(data.values); // set sorted data to initial data state
            renderTable();
          };

          scope.panel.adjustColumnWidth = function() {
            performHeaderPositioning();
          };

          function renderTable() {
            var isHeightSet = setTableHeightVariable();
            if (shouldAbortRender(isHeightSet)) {
              return;
            }

            setHeaders();
            handleSorting();
            handlePaging();
            setTableData();

            elem.find('.table-vis-overflow-container').height(tableHeight);
            elem.height(tableHeight); // set physical height of directive

            $timeout(function() { // after angular is processing, do jquery stuff
              performHeaderPositioning();
            }, 0);
          }

          // on resize or scroll, the absolutely positioned headers will be shifted, during shift we reposition them
          $(window).resize(function() {
            performHeaderPositioning();
          });

          elem.find('.table-vis-overflow-container').scroll(function() {
            performHeaderPositioning();
          });

          // only set headers if there has been a change, since we do not want to lose pre existing sorting options
          function setHeaders() {
            var curHeaders = scope.headers;

            var newHeaders = _.map(data.columnOrder, function(columnName) {
              return { columnName: columnName, sortType: SortType.none };
            });

            if (!curHeaders) {
              scope.headers = newHeaders;
              scope.panel.columnSortOrder = [];
              return;
            }

            var headersChanged = curHeaders.length !== newHeaders.length;
            if (!headersChanged) { // check further to see if they did change
              var curNames = _.pluck(curHeaders, 'columnName');
              var newNames = _.pluck(curHeaders, 'columnName');

              headersChanged = _.difference(curNames, newNames).length > 0;
            }

            if (headersChanged)
            {
              scope.headers = newHeaders;
              scope.panel.columnSortOrder = [];
            }
            else { // if headers haven't changed, we should still ensure that the column aliases are up to date
              for (var i = 0; i < scope.headers.length; ++i) {
                scope.headers[i].columnName = newHeaders[i].columnName;
              }
            }
          }

          function setTableData() {
            // avoid using angular bindings for table data in order to avoid performance penalty
            // in case user wants to view a large number of cells simultaneously
            var tableData = _.reduce(pagedData, function(prevColumn, curColumn) {

              var rowData = _.map(scope.columnOrder, function(columnName) {
                return curColumn[columnName];
              });

              var columnIndex = 0;
              var row = _.map(rowData, function(seriesValue) {
                var colorStyle = getCellColorStyle(seriesValue, columnIndex);
                var formattedValue = getFormattedValue(seriesValue, columnIndex);

                // base row hyperlink on leftmost column if applicable, hence the rowData[0]
                var hyperlinkedTd = getHyperlinkedTd(formattedValue, colorStyle, rowData[0]);
                columnIndex++;

                return '<td ' + colorStyle.textAndBackground + '>' + hyperlinkedTd + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prevColumn += row;
            }, '');

            scope.tableData = $sce.trustAsHtml(tableData);
          }

          function performHeaderPositioning() {
            var container = elem.find('.table-vis-overflow-container');
            var yOffset = container.scrollTop();
            var fixedHeaders = elem.find('.fixed-table-header');

            // set width according to option specification
            if (scope.panel.columnWidth === 'auto') {
              fixedHeaders.width('auto');
            }
            else {
              fixedHeaders.width(scope.panel.columnWidth);
            }

            for (var i = 0; i < fixedHeaders.length; ++i) {
              var fixedEl = fixedHeaders.eq(i);

              var borderOffset = - parseFloat(fixedEl.css('borderWidth')) || 0;
              fixedEl.css({ top: yOffset + borderOffset });
            }

            fixedHeaders.show();
          }

          function setupInitialPaging() {
            scope.panel.numPages = Math.ceil(data.values.length / scope.panel.pageLimit);
            minPage = scope.panel.numPages > 0 ? 1 : 0;

            scope.panel.curTablePage = minPage; // set to first page, since new data has come in
          }

          function handlePaging() {
            dataToSkip = scope.panel.pageLimit * (scope.panel.curTablePage - 1);
            pagedData = sortedData.slice(dataToSkip, scope.panel.pageLimit + dataToSkip);
          }

          function handleSorting() {
            var columnNamesToSort = [];
            var sortOrders = [];

            for (var i = 0; i < scope.panel.columnSortOrder.length; ++i) {
              var columnToSort = scope.panel.columnSortOrder[i]; // take from list of column sort priority
              var sortType = columnToSort.sortType;

              if (sortType !== SortType.none) {
                columnNamesToSort.push(columnToSort.columnName);
                sortOrders.push(columnToSort.sortType === SortType.asc ? true : false);
              }
            }

            sortedData = _.sortByOrder(data.values, columnNamesToSort, sortOrders);
          }

          function changeSortType(header) {
            var newType = null;

            switch (header.sortType) {
              case SortType.none:
                newType = SortType.asc;
                scope.panel.columnSortOrder.push(header); // we are beginning to sort by header column, so add to array
                break;

              case SortType.asc:
                newType = SortType.desc;
                break;

              case SortType.desc:
                newType = SortType.none;
                // since we are no longer sorting, remove from sort order array
                scope.panel.columnSortOrder = _.filter(scope.panel.columnSortOrder, function(sortedHeader) {
                  return header !== sortedHeader;
                });
                break;
            }

            header.sortType = newType;
          }

          function getCellColorStyle(value, columnIndex) {
            function getColorForValue(value) {
              for (var i = coloring.thresholdValues.length - 1; i >= 0; i--) {
                if (value >= coloring.thresholdValues[i]) {
                  return coloring.colors[i];
                }
              }

              return null;
            }

            var colorHtml = { textAndBackground: '', textOnly: '' };
            var backgroundHtml = '';
            var textHtml = '';

            var targetIndex = columnIndex - 1; // first column is reference column (timeseries or aggregate)
            // and should not be highlighted with colors

            if (scope.panel.targets.length === 0 || targetIndex < 0 || !scope.panel.targets[targetIndex] || value === null) {
              return colorHtml;
            }

            var coloring = scope.panel.targets[targetIndex].coloring;

            if (coloring && (coloring.colorBackground || coloring.colorValue) && !isNaN(value)) {
              var color = getColorForValue(value);
              if (color) {
                if (coloring.colorValue) {
                  textHtml = 'color:' + color + ';';
                }
                if (coloring.colorBackground) {
                  backgroundHtml = 'background-color:' + color + ';';
                }
              }
            }

            colorHtml.textAndBackground = backgroundHtml || textHtml ? 'style="' + backgroundHtml + textHtml + ';"' : '';
            colorHtml.textOnly = textHtml ? 'style="' + textHtml + ';"' : '';
            return colorHtml;
          }

          function getFormattedValue(value, columnIndex) {
            if (columnIndex === 0) { // reference column
              if (scope.panel.inTimeSeriesMode && scope.panel.showTimeAsDate) { // if timeseries table and checkbox selected
                return moment(value).format('L HH:mm:ss');
              }

              return value;
            }

            var decimalLimit = scope.panel.decimalLimit;
            if (value !== null && !isNaN(value) && decimalLimit !== null && !isNaN(decimalLimit)) {
              return value.toFixed(decimalLimit);
            }

            return value;
          }

          function getHyperlinkedTd(formattedValue, colorStyle, referenceTag) {
            if (!scope.panel.allowScriptedRagLink || !scope.panel.scriptedRagLink) {
              return formattedValue;
            }

            return '<a target="_new"' + colorStyle.textOnly + ' href="' +
              scope.panel.scriptedRagLink.replace('$tagName', referenceTag) + '">' + formattedValue +
            '</a>';

          }

          function shouldAbortRender(isHeightSet) {
            if (!data) {
              return true;
            }

            if ($rootScope.fullscreen && !scope.fullscreen) {
              return true;
            }

            if (!isHeightSet) { return true; }

            if (elem.width() === 0) {
              return false;
            }
          }

          function setTableHeightVariable() {
            var docHeight = $(window).height();
            var editscreenHeight = Math.floor(docHeight * 0.6);
            var fullscreenHeight = Math.floor(docHeight * 0.7);

            // editing takes up a lot of space, so it should be set accordingly
            if (scope.editMode) {
              scope.height = editscreenHeight;
            }
            else if (scope.fullscreen) {
              scope.height = fullscreenHeight;
            }
            else {
              scope.height = null; // if in normal dashboard mode
            }

            try {
              tableHeight = scope.height || scope.panel.height || scope.row.height;
              if (_.isString(tableHeight)) {
                tableHeight = parseInt(tableHeight.replace('px', ''), 10);
              }

              tableHeight -= 5; // padding
              tableHeight -= scope.panel.title ? 24 : 9; // subtract panel title bar
              tableHeight -= scope.shouldHidePaginationControl() ? 0 : 57; // subtract paginator height/margin if applicable

              return true;
            } catch(e) { // IE throws errors sometimes
              return false;
            }
          }

        }
      };
    });
  });
