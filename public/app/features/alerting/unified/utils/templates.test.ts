import { updateDefinesWithUniqueValue } from './templates';

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  now: jest.fn().mockImplementation(() => 99),
}));
describe('updateDefinesWithUniqueValue method', () => {
  describe('only onw define', () => {
    it('Should update the define values with a unique new one', () => {
      expect(updateDefinesWithUniqueValue(`{{ define "t" }}\n{{.Alerts.Firing}}\n{{ end }}`)).toEqual(
        `{{ define "t_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}`
      );
    });
  });
  describe('more than one define in the template', () => {
    it('Should update the define values with a unique new one ', () => {
      expect(
        updateDefinesWithUniqueValue(
          `{{ define "t1" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t2" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t3" }}\n{{.Alerts.Firing}}\n{{ end }}\n`
        )
      ).toEqual(
        `{{ define "t1_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t2_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t3_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n`
      );
    });

    it('Should update the define values with a unique new one, special chars included in the value', () => {
      expect(
        updateDefinesWithUniqueValue(
          `{{ define "t1 /^*;$@" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t2" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t3" }}\n{{.Alerts.Firing}}\n{{ end }}\n`
        )
      ).toEqual(
        `{{ define "t1 /^*;$@_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t2_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n{{ define "t3_NEW_99" }}\n{{.Alerts.Firing}}\n{{ end }}\n`
      );
    });
  });
});
