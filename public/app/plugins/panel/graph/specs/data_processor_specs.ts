///<reference path="../../../../headers/common.d.ts" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from '../../../../../test/lib/common';

import {DataProcessor} from '../data_processor';

describe('Graph DataProcessor', function() {
  var panel: any = {
    xaxis: {}
  };
  var processor = new DataProcessor(panel);
  var seriesList;

  describe('Given default xaxis options and query that returns docs', () => {

    beforeEach(() => {
      panel.xaxis.mode = 'time';
      panel.xaxis.name = 'hostname';
      panel.xaxis.values = [];

      seriesList = processor.getSeriesList({
        dataList: [
          {
            type: 'docs',
            datapoints: [{hostname: "server1", avg: 10}]
          }
        ]
      });
    });

    it('Should automatically set xaxis mode to custom', () => {
      expect(panel.xaxis.mode).to.be('custom');
    });

  });

});

