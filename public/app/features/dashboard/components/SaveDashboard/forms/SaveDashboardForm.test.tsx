import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { DashboardModel } from 'app/features/dashboard/state';
import { SaveDashboardForm } from './SaveDashboardForm';

const prepareDashboardMock = (
  timeChanged: boolean,
  variableValuesChanged: boolean,
  resetTimeSpy: any,
  resetVarsSpy: any
) => {
  const json = {
    title: 'name',
    hasTimeChanged: jest.fn().mockReturnValue(timeChanged),
    hasVariableValuesChanged: jest.fn().mockReturnValue(variableValuesChanged),
    resetOriginalTime: () => resetTimeSpy(),
    resetOriginalVariables: () => resetVarsSpy(),
    getSaveModelClone: jest.fn().mockReturnValue({}),
  };

  return {
    id: 5,
    meta: {},
    ...json,
    getSaveModelClone: () => json,
  };
};
const renderAndSubmitForm = async (dashboard: any, submitSpy: any) => {
  const container = mount(
    <SaveDashboardForm
      dashboard={dashboard as DashboardModel}
      onCancel={() => {}}
      onSuccess={() => {}}
      onSubmit={async jsonModel => {
        submitSpy(jsonModel);
        return { status: 'success' };
      }}
    />
  );

  // @ts-ignore strict null error below
  await act(async () => {
    const button = container.find('button[aria-label="Dashboard settings Save Dashboard Modal Save button"]');
    button.simulate('submit');
  });
};
describe('SaveDashboardAsForm', () => {
  describe('time and variables toggle rendering', () => {
    it('renders switches when variables or timerange', () => {
      const container = mount(
        <SaveDashboardForm
          dashboard={prepareDashboardMock(true, true, jest.fn(), jest.fn()) as any}
          onCancel={() => {}}
          onSuccess={() => {}}
          onSubmit={async () => {
            return {};
          }}
        />
      );

      const variablesCheckbox = container.find(
        'input[aria-label="Dashboard settings Save Dashboard Modal Save variables checkbox"]'
      );
      const timeRangeCheckbox = container.find(
        'input[aria-label="Dashboard settings Save Dashboard Modal Save timerange checkbox"]'
      );

      expect(variablesCheckbox).toHaveLength(1);
      expect(timeRangeCheckbox).toHaveLength(1);
    });
  });

  describe("when time and template vars haven't changed", () => {
    it("doesn't reset dashboard time and vars", async () => {
      const resetTimeSpy = jest.fn();
      const resetVarsSpy = jest.fn();
      const submitSpy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock(false, false, resetTimeSpy, resetVarsSpy) as any, submitSpy);

      expect(resetTimeSpy).not.toBeCalled();
      expect(resetVarsSpy).not.toBeCalled();
      expect(submitSpy).toBeCalledTimes(1);
    });
  });
  describe('when time and template vars have changed', () => {
    describe("and user hasn't checked variable and time range save", () => {
      it('dont reset dashboard time and vars', async () => {
        const resetTimeSpy = jest.fn();
        const resetVarsSpy = jest.fn();
        const submitSpy = jest.fn();
        await renderAndSubmitForm(prepareDashboardMock(true, true, resetTimeSpy, resetVarsSpy) as any, submitSpy);

        expect(resetTimeSpy).toBeCalledTimes(0);
        expect(resetVarsSpy).toBeCalledTimes(0);
        expect(submitSpy).toBeCalledTimes(1);
      });
    });
  });
});
