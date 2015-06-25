define([
  'angular',
  'lodash',
  'text!panels/table/table.html',
  'panels/table/table'
], function(angular, _, templateHtml) {
  'use strict';

  // Column names are sequential strings
  // If the user requests 1 column, the returned column name will "1"
  // if the user requests 2 columns, the returned column names will be "1", "2"
  function getRandomData(numColumns, numRows) {
    var data = [];
    var selectedColumns = [];
    var i, j;

    for (i = 0; i < numColumns; ++i) {
      selectedColumns.push(String(i));
    }

    for (i = 0; i < numRows; ++i) {
      var row = { Time: i + 10000 };

      for (j = 0; j < numColumns; ++j) {
        var columnName = selectedColumns[j];
        var value = Math.random();
        row[columnName] = value;
      }
      data.push(row);
    }

    return {columnOrder: selectedColumns, values: data};
  }

  describe('grafanaTable', function() {
    var elem;
    var scope;

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.directives'));

    beforeEach(inject(function($rootScope, $compile, $templateCache) {
      $templateCache.put('app/panels/table/table.html',templateHtml);

      scope = $rootScope.$new();
      var html = angular.element("<div grafana-table><div>");

      var _d = {
        title   : 'default title',
        datasource: null,
        content : "",
        style: {},
        timeFrom: null,
        timeShift: null,
        targets: [ // only used for coloring
          { measurement: 'stuff', query: 'to be or not to be', $$hashKey: 1, coloring: {} },
          { measurement: 'more stuff', query: 'two bee or not too bie', $$hashKey: 2,
            coloring: {
              thresholdCommaString: '20, 60, 90',
              thresholdValues: [20, 60, 90],
              colors: ["rgb(245, 54, 54)", "rgb(237, 129, 40)", "rgb(50, 172, 45)"],
              colorBackground: true,
              colorValue: true
            }
          }
        ],
        columnWidth: 'auto',
        allowPaging: true,
        pageLimit: 20,
        allowSorting: true
      };

      scope.permittedColumnWidthRange = _.range(20, 200);
      scope.panel = {};
      _.defaults(scope.panel, _d);

      elem = $compile(html)(scope);
      scope.$digest();
    }));

    beforeEach(function() {
      // following needed for table to render
      scope.fullscreen = true;
      scope.shouldHidePaginationControl = function() { return true; };
    });


    describe('paging', function() {
      it('should return 1 page for 3 data results and a pageLimit of 20', function() {
        var data = getRandomData(1, 3);
        scope.panel.pageLimit = 20;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(1);
      });

      it('should return 3 pages for 15 data results and a pageLimit of 5', function() {
        var data = getRandomData(1, 15);
        scope.panel.pageLimit = 5;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(3);
      });

      it('should return 0 pages for 0 data results', function() {
        var data = getRandomData(1, 0);
        scope.panel.pageLimit = 5;

        scope.$emit('render', data);
        scope.$digest();

        expect(scope.panel.numPages).to.equal(0);
      });
    });

    describe('rendered tables', function() {
      var jqLiteTable;
      var tbody;

      function renderAndSetElementVars(data) {
        scope.$emit('render', data);
        scope.$digest();

        jqLiteTable = angular.element(elem);
        tbody = jqLiteTable.find('tbody tr');
      }

      // the rendered table body does not use angular bindings, (it uses manual string building) so we should test it
      it ('should have correct number of rows', function() {
        var dataRows = 3;
        scope.panel.pageLimit = 5;

        var data = getRandomData(1, dataRows);
        renderAndSetElementVars(data);

        expect(tbody.length).to.equal(dataRows);
      });

      it('should limit rendered rows to data page limit', function() {
        var dataRows = 100;
        scope.panel.pageLimit = 5;

        var data = getRandomData(1, dataRows);
        renderAndSetElementVars(data);

        expect(tbody.length).to.equal(scope.panel.pageLimit);
      });

      it('should have rendered table that matches object data', function() {
        scope.panel.pageLimit = 5;

        var data = getRandomData(2, 5);
        renderAndSetElementVars(data);


        for (var rowIndex = 0; rowIndex < tbody.length; ++rowIndex) {
          var row = tbody.eq(rowIndex);
          var rowData = row.find('td');

          for (var columnIndex = 0; columnIndex < rowData.length; ++columnIndex) {
            var cell = rowData.eq(columnIndex);
            var cellData = cell.text();

            var columnName = scope.columnOrder[columnIndex];

            var objectData = data.values[rowIndex][columnName].toString();

            expect(cellData).to.equal(objectData);

          }
        }
      });

      describe('decimal formatting', function() {
        it('should not do anything if not turned on', function() {
          var data = getRandomData(2, 2);
          renderAndSetElementVars(data);

          scope.panel.decimalLimit = 'auto';

          for (var rowIndex = 0; rowIndex < tbody.length; ++rowIndex) {
            var row = tbody.eq(rowIndex);
            var rowData = row.find('td');

            // start at 1 since first column is reference column
            for (var columnIndex = 1; columnIndex < rowData.length; ++columnIndex) {
              var cell = rowData.eq(columnIndex);
              var cellData = cell.text();

              var columnName = scope.columnOrder[columnIndex];

              var objectData = data.values[rowIndex][columnName].toString();

              expect(cellData).to.equal(objectData);
            }
          }
        });

        it('should render correctly if turned on', function() {
          var data = getRandomData(2, 2);

          scope.panel.decimalLimit = 2;
          renderAndSetElementVars(data);

          for (var rowIndex = 0; rowIndex < tbody.length; ++rowIndex) {
            var row = tbody.eq(rowIndex);
            var rowData = row.find('td');

            // start at 1 since first column is reference column
            for (var columnIndex = 1; columnIndex < rowData.length; ++columnIndex) {
              var cell = rowData.eq(columnIndex);
              var cellData = cell.text();

              var columnName = scope.columnOrder[columnIndex];

              var objectData = data.values[rowIndex][columnName].toFixed(scope.panel.decimalLimit);

              expect(cellData).to.equal(objectData);
              var decimalLength = objectData.split('.')[1].length;
              expect(decimalLength).to.equal(scope.panel.decimalLimit);
            }
          }
        });
      });

      describe('color formatting', function() {
        function getCellColors(rowIndex, colIndex) {
          var row = tbody.eq(rowIndex);
          var rowData = row.find('td');
          var cell = rowData.eq(colIndex);

          var cellTextColor = cell.css('color');
          var cellBgColor = cell.css('backgroundColor');

          return { fontC: cellTextColor, bgC: cellBgColor };
        }

        beforeEach(function() {
          var columnOrder = ['Time','Column1','Column2'];
          var values = [
            {Time: 1429899796009, Column1: 30, Column2: 100},
            {Time: 1429899796019, Column1: 13, Column2: 50},
            {Time: 1429899796029, Column1: 5, Column2: null},
            {Time: 1429899796029, Column1: null, Column2: 10}
          ];

          var bigData = {columnOrder: columnOrder, values: values};

          scope.panel.pageLimit = 5;


          renderAndSetElementVars(bigData);
        });


        it('should meet thresholds correctly on the correct targets', function() {
          // first column should be not contain colors since it (targets[0]) does not have a defined color scheme
          for (var i = 0; i < 4; i++) {
            var cellColors = getCellColors(i, 1);
            expect(cellColors.fontC).to.equal('');
            expect(cellColors.bgC).to.equal('');
          }


          var c02 = getCellColors(0, 2);
          expect(c02.fontC).to.equal('rgb(50, 172, 45)');
          expect(c02.bgC).to.equal('rgb(50, 172, 45)');

          var c12 = getCellColors(1, 2);
          expect(c12.fontC).to.equal('rgb(245, 54, 54)');
          expect(c12.bgC).to.equal('rgb(245, 54, 54)');

          var c22 = getCellColors(2, 2);
          expect(c22.fontC).to.equal('');
          expect(c22.bgC).to.equal('');

          var c23 = getCellColors(3, 2);
          expect(c23.fontC).to.equal('');
          expect(c23.bgC).to.equal('');
        });
      });

      describe('ragHyperlinks', function() {
        function render(allowLinks) {
          scope.panel.allowScriptedRagLink = allowLinks;
          scope.panel.scriptedRagLink = 'randomUrl$tagName';

          var columnOrder = ['Name','Value'];
          var values = [
            {Name: 'fun1', Value: 100},
            {Name: 'fun2', Value: 50}
          ];

          var bigData = {columnOrder: columnOrder, values: values};
          scope.panel.pageLimit = 5;
          renderAndSetElementVars(bigData);
        }

        it('should links properly when selected', function() {
          render(true);

          var row0 = tbody.eq(0);
          var row0Links = row0.find('a');
          expect(row0Links.length).to.equal(2); // one link for each cell
          expect(row0Links.eq(0).attr('href')).to.equal('randomUrlfun1');
          expect(row0Links.eq(1).attr('href')).to.equal('randomUrlfun1');

          var row1 = tbody.eq(1);
          var row1Links = row1.find('a');
          expect(row1Links.length).to.equal(2); // one link for each cell
          expect(row1Links.eq(0).attr('href')).to.equal('randomUrlfun2');
          expect(row1Links.eq(1).attr('href')).to.equal('randomUrlfun2');
        });

        it('should not render links when not selected', function() {
          render(false);

          var row0 = tbody.eq(0);
          var row0Links = row0.find('a');
          expect(row0Links.length).to.equal(0); // there should be no hyperlinks

          var row1 = tbody.eq(1);
          var row1Links = row1.find('a');
          expect(row1Links.length).to.equal(0);
        });

      });


    });


    describe('sorting with headers', function() {
      beforeEach(function() {
        var dataRows = 3;
        var numColumns = 3;

        scope.panel.pageLimit = 5;

        var data = getRandomData(numColumns, dataRows);

        scope.$emit('render', data);
        scope.$digest();
      });

      it('should initially have no sorting order', function() {
        scope.headers.forEach(function(header) {
          expect(header.sortType).to.equal(scope.sortType.none);
        });

        expect(scope.panel.columnSortOrder.length).to.equal(0);
      });

      it('should alter header sort state based on user interaction', function() {
        var header = scope.headers[0];
        expect(header.sortType).to.equal(scope.sortType.none);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.asc);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.desc);

        scope.headerClicked(header);
        expect(header.sortType).to.equal(scope.sortType.none);
      });


      it('should remove a column from being sorted when user removes sorting', function() {
        // initially sort all headers
        scope.headers.forEach(function(header) {
          scope.headerClicked(header);
        });

        var middleHeader = scope.headers[1];
        scope.headerClicked(middleHeader); // set to desc order
        scope.headerClicked(middleHeader); // set to none
        expect(middleHeader.sortType).to.equal(scope.sortType.none);


        // since middle column is no longer sorted, it should not be in the column sort order
        expect(scope.panel.columnSortOrder.length).to.equal(2);
        expect(scope.panel.columnSortOrder[0]).to.be(scope.headers[0]);
        expect(scope.panel.columnSortOrder[1]).to.be(scope.headers[2]);
      });

      // order of column sorting is retained
      it('the first header clicked should remain first in sorting priority until it is removed', function() {
        var firstHeaderClicked = scope.headers[2];
        var secondHeaderClicked = scope.headers[1];
        var thirdHeaderClicked = scope.headers[0];

        scope.headerClicked(firstHeaderClicked);

        // click other headers
        scope.headerClicked(secondHeaderClicked);
        scope.headerClicked(thirdHeaderClicked);

        // click first header to change sorting order to desc
        scope.headerClicked(firstHeaderClicked);

        // despite being clicked again after other headers were clicked, it should retain it's initial insert order
        expect(scope.panel.columnSortOrder[0]).to.be(firstHeaderClicked);
      });

    });
  });

});
