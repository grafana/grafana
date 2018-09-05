import { SingleStatCtrl } from '../module';
import moment from 'moment';

describe('SingleStatCtrl', () => {
  const ctx = {} as any;
  const epoch = 1505826363746;
  Date.now = () => epoch;

  const $scope = {
    $on: () => {},
  };

  const $injector = {
    get: () => {},
  };

  SingleStatCtrl.prototype.panel = {
    events: {
      on: () => {},
      emit: () => {},
    },
  };
  SingleStatCtrl.prototype.dashboard = {
    isTimezoneUtc: jest.fn(() => true),
  };
  SingleStatCtrl.prototype.events = {
    on: () => {},
  };

  function singleStatScenario(desc, func) {
    describe(desc, () => {
      ctx.setup = setupFunc => {
        beforeEach(() => {
          ctx.ctrl = new SingleStatCtrl($scope, $injector, {});
          setupFunc();
          ctx.ctrl.onDataReceived(ctx.data);
          ctx.data = ctx.ctrl.data;
        });
      };

      func(ctx);
    });
  }

  singleStatScenario('with defaults', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 1], [20, 2]] }];
    });

    it('Should use series avg as default main value', () => {
      expect(ctx.data.value).toBe(15);
      expect(ctx.data.valueRounded).toBe(15);
    });

    it('should set formatted falue', () => {
      expect(ctx.data.valueFormatted).toBe('15');
    });
  });

  singleStatScenario('showing serie name instead of value', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 1], [20, 2]] }];
      ctx.ctrl.panel.valueName = 'name';
    });

    it('Should use series avg as default main value', () => {
      expect(ctx.data.value).toBe(0);
      expect(ctx.data.valueRounded).toBe(0);
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe('test.cpu1');
    });
  });

  singleStatScenario('showing last iso time instead of value', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsIso';
      ctx.ctrl.dashboard.isTimezoneUtc = () => false;
    });

    it('Should use time instead of value', () => {
      expect(ctx.data.value).toBe(1505634997920);
      expect(ctx.data.valueRounded).toBe(1505634997920);
    });

    it('should set formatted value', () => {
      expect(moment(ctx.data.valueFormatted).valueOf()).toBe(1505634997000);
    });
  });

  singleStatScenario('showing last iso time instead of value (in UTC)', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 5000]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsIso';
      ctx.ctrl.dashboard.isTimezoneUtc = () => true;
    });

    it('should set value', () => {
      expect(ctx.data.valueFormatted).toBe('1970-01-01 00:00:05');
    });
  });

  singleStatScenario('showing last us time instead of value', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsUS';
      ctx.ctrl.dashboard.isTimezoneUtc = () => false;
    });

    it('Should use time instead of value', () => {
      expect(ctx.data.value).toBe(1505634997920);
      expect(ctx.data.valueRounded).toBe(1505634997920);
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe(moment(1505634997920).format('MM/DD/YYYY h:mm:ss a'));
    });
  });

  singleStatScenario('showing last us time instead of value (in UTC)', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 5000]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeAsUS';
      ctx.ctrl.dashboard.isTimezoneUtc = () => true;
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe('01/01/1970 12:00:05 am');
    });
  });

  singleStatScenario('showing last time from now instead of value', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeFromNow';
    });

    it('Should use time instead of value', () => {
      expect(ctx.data.value).toBe(1505634997920);
      expect(ctx.data.valueRounded).toBe(1505634997920);
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe('2 days ago');
    });
  });

  singleStatScenario('showing last time from now instead of value (in UTC)', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[10, 12], [20, 1505634997920]] }];
      ctx.ctrl.panel.valueName = 'last_time';
      ctx.ctrl.panel.format = 'dateTimeFromNow';
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe('2 days ago');
    });
  });

  singleStatScenario('MainValue should use same number for decimals as displayed when checking thresholds', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[99.999, 1], [99.99999, 2]] }];
      ctx.ctrl.panel.valueName = 'avg';
      ctx.ctrl.panel.format = 'none';
    });

    it('Should be rounded', () => {
      expect(ctx.data.value).toBe(99.999495);
      expect(ctx.data.valueRounded).toBe(100);
    });

    it('should set formatted value', () => {
      expect(ctx.data.valueFormatted).toBe('100');
    });
  });

  singleStatScenario('When value to text mapping is specified', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[9.9, 1]] }];
      ctx.ctrl.panel.valueMaps = [{ value: '10', text: 'OK' }];
    });

    it('value should remain', () => {
      expect(ctx.data.value).toBe(9.9);
    });

    it('round should be rounded up', () => {
      expect(ctx.data.valueRounded).toBe(10);
    });

    it('Should replace value with text', () => {
      expect(ctx.data.valueFormatted).toBe('OK');
    });
  });

  singleStatScenario('When range to text mapping is specified for first range', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[41, 50]] }];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
    });

    it('Should replace value with text OK', () => {
      expect(ctx.data.valueFormatted).toBe('OK');
    });
  });

  singleStatScenario('When range to text mapping is specified for other ranges', ctx => {
    ctx.setup(() => {
      ctx.data = [{ target: 'test.cpu1', datapoints: [[65, 75]] }];
      ctx.ctrl.panel.mappingType = 2;
      ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
    });

    it('Should replace value with text NOT OK', () => {
      expect(ctx.data.valueFormatted).toBe('NOT OK');
    });
  });

  describe('When table data', () => {
    const tableData = [
      {
        columns: [{ text: 'Time', type: 'time' }, { text: 'test1' }, { text: 'mean' }, { text: 'test2' }],
        rows: [[1492759673649, 'ignore1', 15, 'ignore2']],
        type: 'table',
      },
    ];

    singleStatScenario('with default values', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.ctrl.panel = {
          emit: () => {},
        };
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.format = 'none';
      });

      it('Should use first rows value as default main value', () => {
        expect(ctx.data.value).toBe(15);
        expect(ctx.data.valueRounded).toBe(15);
      });

      it('should set formatted value', () => {
        expect(ctx.data.valueFormatted).toBe('15');
      });
    });

    singleStatScenario('When table data has multiple columns', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.ctrl.panel.tableColumn = '';
      });

      it('Should set column to first column that is not time', () => {
        expect(ctx.ctrl.panel.tableColumn).toBe('test1');
      });
    });

    singleStatScenario('MainValue should use same number for decimals as displayed when checking thresholds', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 99.99999, 'ignore2'];
        ctx.ctrl.panel.mappingType = 0;
        ctx.ctrl.panel.tableColumn = 'mean';
      });

      it('Should be rounded', () => {
        expect(ctx.data.value).toBe(99.99999);
        expect(ctx.data.valueRounded).toBe(100);
      });

      it('should set formatted falue', () => {
        expect(ctx.data.valueFormatted).toBe('100');
      });
    });

    singleStatScenario('When value to text mapping is specified', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 9.9, 'ignore2'];
        ctx.ctrl.panel.mappingType = 2;
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.valueMaps = [{ value: '10', text: 'OK' }];
      });

      it('value should remain', () => {
        expect(ctx.data.value).toBe(9.9);
      });

      it('round should be rounded up', () => {
        expect(ctx.data.valueRounded).toBe(10);
      });

      it('Should replace value with text', () => {
        expect(ctx.data.valueFormatted).toBe('OK');
      });
    });

    singleStatScenario('When range to text mapping is specified for first range', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 41, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.mappingType = 2;
        ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
      });

      it('Should replace value with text OK', () => {
        expect(ctx.data.valueFormatted).toBe('OK');
      });
    });

    singleStatScenario('When range to text mapping is specified for other ranges', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 65, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
        ctx.ctrl.panel.mappingType = 2;
        ctx.ctrl.panel.rangeMaps = [{ from: '10', to: '50', text: 'OK' }, { from: '51', to: '100', text: 'NOT OK' }];
      });

      it('Should replace value with text NOT OK', () => {
        expect(ctx.data.valueFormatted).toBe('NOT OK');
      });
    });

    singleStatScenario('When value is string', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 65, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'test1';
      });

      it('Should replace value with text NOT OK', () => {
        expect(ctx.data.valueFormatted).toBe('ignore1');
      });
    });

    singleStatScenario('When value is zero', ctx => {
      ctx.setup(() => {
        ctx.data = tableData;
        ctx.data[0].rows[0] = [1492759673649, 'ignore1', 0, 'ignore2'];
        ctx.ctrl.panel.tableColumn = 'mean';
      });

      it('Should return zero', () => {
        expect(ctx.data.value).toBe(0);
      });
    });
  });
});
