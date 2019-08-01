import { SaveDashboardModalCtrl } from './SaveDashboardModalCtrl';

const setup = (timeChanged: boolean, variableValuesChanged: boolean, cb: Function) => {
  const dash = {
    hasTimeChanged: jest.fn().mockReturnValue(timeChanged),
    hasVariableValuesChanged: jest.fn().mockReturnValue(variableValuesChanged),
    resetOriginalTime: jest.fn(),
    resetOriginalVariables: jest.fn(),
    getSaveModelClone: jest.fn().mockReturnValue({}),
  };
  const dashboardSrvMock: any = {
    getCurrent: jest.fn().mockReturnValue(dash),
    save: jest.fn().mockReturnValue(Promise.resolve()),
  };
  const ctrl = new SaveDashboardModalCtrl(dashboardSrvMock);
  ctrl.saveForm = {
    $valid: true,
  };
  ctrl.dismiss = () => Promise.resolve();
  cb(dash, ctrl, dashboardSrvMock);
};

describe('SaveDashboardModal', () => {
  describe('Given time and template variable values have not changed', () => {
    setup(false, false, (dash: any, ctrl: SaveDashboardModalCtrl) => {
      it('When creating ctrl should set time and template variable values changed', () => {
        expect(ctrl.timeChange).toBeFalsy();
        expect(ctrl.variableValueChange).toBeFalsy();
      });
    });
  });

  describe('Given time and template variable values have changed', () => {
    setup(true, true, (dash: any, ctrl: SaveDashboardModalCtrl) => {
      it('When creating ctrl should set time and template variable values changed', () => {
        expect(ctrl.timeChange).toBeTruthy();
        expect(ctrl.variableValueChange).toBeTruthy();
      });

      it('When save time and variable value changes disabled and saving should reset original time and template variable values', async () => {
        ctrl.saveTimerange = false;
        ctrl.saveVariables = false;
        await ctrl.save();
        expect(dash.resetOriginalTime).toHaveBeenCalledTimes(0);
        expect(dash.resetOriginalVariables).toHaveBeenCalledTimes(0);
      });

      it('When save time and variable value changes enabled and saving should reset original time and template variable values', async () => {
        ctrl.saveTimerange = true;
        ctrl.saveVariables = true;
        await ctrl.save();
        expect(dash.resetOriginalTime).toHaveBeenCalledTimes(1);
        expect(dash.resetOriginalVariables).toHaveBeenCalledTimes(1);
      });
    });
  });
});
