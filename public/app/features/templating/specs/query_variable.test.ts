import { QueryVariable } from '../query_variable';
import DatasourceSrv from '../../plugins/datasource_srv';
import { TemplateSrv } from '../template_srv';
import { VariableSrv } from '../variable_srv';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

describe('QueryVariable', () => {
  describe('when creating from model', () => {
    it('should set defaults', () => {
      const variable = new QueryVariable(
        {},
        (null as unknown) as DatasourceSrv,
        (null as unknown) as TemplateSrv,
        (null as unknown) as VariableSrv,
        (null as unknown) as TimeSrv
      );
      expect(variable.datasource).toBe(null);
      expect(variable.refresh).toBe(0);
      expect(variable.sort).toBe(0);
      expect(variable.name).toBe('');
      expect(variable.hide).toBe(0);
      expect(variable.options.length).toBe(0);
      expect(variable.multi).toBe(false);
      expect(variable.includeAll).toBe(false);
    });

    it('get model should copy changes back to model', () => {
      const variable = new QueryVariable(
        {},
        (null as unknown) as DatasourceSrv,
        (null as unknown) as TemplateSrv,
        (null as unknown) as VariableSrv,
        (null as unknown) as TimeSrv
      );
      variable.options = [{ text: 'test', value: '', selected: false }];
      variable.datasource = 'google';
      variable.regex = 'asd';
      variable.sort = 50;

      const model = variable.getSaveModel();
      expect(model.options.length).toBe(1);
      expect(model.options[0].text).toBe('test');
      expect(model.datasource).toBe('google');
      expect(model.regex).toBe('asd');
      expect(model.sort).toBe(50);
    });

    it('if refresh != 0 then remove options in presisted mode', () => {
      const variable = new QueryVariable(
        {},
        (null as unknown) as DatasourceSrv,
        (null as unknown) as TemplateSrv,
        (null as unknown) as VariableSrv,
        (null as unknown) as TimeSrv
      );
      variable.options = [{ text: 'test', value: '', selected: false }];
      variable.refresh = 1;

      const model = variable.getSaveModel();
      expect(model.options.length).toBe(0);
    });
  });

  describe('can convert and sort metric names', () => {
    const variable = new QueryVariable(
      {},
      (null as unknown) as DatasourceSrv,
      (null as unknown) as TemplateSrv,
      (null as unknown) as VariableSrv,
      (null as unknown) as TimeSrv
    );
    let input: any;

    beforeEach(() => {
      input = [
        { text: '0', value: '0' },
        { text: '1', value: '1' },
        { text: null, value: 3 },
        { text: undefined, value: 4 },
        { text: '5', value: null },
        { text: '6', value: undefined },
        { text: null, value: '7' },
        { text: undefined, value: '8' },
        { text: 9, value: null },
        { text: 10, value: undefined },
        { text: '', value: undefined },
        { text: undefined, value: '' },
      ];
    });

    describe('can sort a mixed array of metric variables in numeric order', () => {
      let result: any;

      beforeEach(() => {
        variable.sort = 3; // Numerical (asc)
        result = variable.metricNamesToVariableValues(input);
      });

      it('should return in same order', () => {
        let i = 0;
        expect(result.length).toBe(11);
        expect(result[i++].text).toBe('');
        expect(result[i++].text).toBe('0');
        expect(result[i++].text).toBe('1');
        expect(result[i++].text).toBe('3');
        expect(result[i++].text).toBe('4');
        expect(result[i++].text).toBe('5');
        expect(result[i++].text).toBe('6');
      });
    });

    describe('can sort a mixed array of metric variables in alphabetical order', () => {
      let result: any;

      beforeEach(() => {
        variable.sort = 5; // Alphabetical CI (asc)
        result = variable.metricNamesToVariableValues(input);
      });

      it('should return in same order', () => {
        let i = 0;
        expect(result.length).toBe(11);
        expect(result[i++].text).toBe('');
        expect(result[i++].text).toBe('0');
        expect(result[i++].text).toBe('1');
        expect(result[i++].text).toBe('10');
        expect(result[i++].text).toBe('3');
        expect(result[i++].text).toBe('4');
        expect(result[i++].text).toBe('5');
      });
    });
  });
});
