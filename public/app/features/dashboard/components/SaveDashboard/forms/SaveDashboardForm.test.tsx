import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DashboardModel } from 'app/features/dashboard/state';

import { SaveDashboardOptions } from '../types';

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
  render(
    <SaveDashboardForm
      dashboard={dashboard as DashboardModel}
      onCancel={() => {}}
      onSuccess={() => {}}
      onSubmit={async (jsonModel) => {
        submitSpy(jsonModel);
        return { status: 'success' };
      }}
      saveModel={{
        clone: dashboard,
        diff: {},
        diffCount: 0,
        hasChanges: true,
      }}
      options={{}}
      onOptionsChange={(opts: SaveDashboardOptions) => {
        return;
      }}
    />
  );

  const button = screen.getByRole('button', { name: 'Dashboard settings Save Dashboard Modal Save button' });
  await userEvent.click(button);
};
describe('SaveDashboardAsForm', () => {
  describe('time and variables toggle rendering', () => {
    it('renders switches when variables or timerange', () => {
      render(
        <SaveDashboardForm
          dashboard={prepareDashboardMock(true, true, jest.fn(), jest.fn()) as any}
          onCancel={() => {}}
          onSuccess={() => {}}
          onSubmit={async () => {
            return {};
          }}
          saveModel={{
            clone: prepareDashboardMock(true, true, jest.fn(), jest.fn()) as any,
            diff: {},
            diffCount: 0,
            hasChanges: true,
          }}
          options={{}}
          onOptionsChange={(opts: SaveDashboardOptions) => {
            return;
          }}
        />
      );

      const variablesCheckbox = screen.getByRole('checkbox', {
        name: 'Dashboard settings Save Dashboard Modal Save variables checkbox',
      });
      const timeRangeCheckbox = screen.getByRole('checkbox', {
        name: 'Dashboard settings Save Dashboard Modal Save timerange checkbox',
      });

      expect(variablesCheckbox).toBeInTheDocument();
      expect(timeRangeCheckbox).toBeInTheDocument();
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
  describe('saved message draft rendered', () => {
    it('renders saved message draft if it was filled before', () => {
      render(
        <SaveDashboardForm
          dashboard={new DashboardModel({})}
          onCancel={() => {}}
          onSuccess={() => {}}
          onSubmit={async () => {
            return {};
          }}
          saveModel={{
            clone: new DashboardModel({}),
            diff: {},
            diffCount: 0,
            hasChanges: true,
          }}
          options={{ message: 'Saved draft' }}
          onOptionsChange={(opts: SaveDashboardOptions) => {
            return;
          }}
        />
      );

      const messageTextArea = screen.getByLabelText('message');

      expect(messageTextArea).toBeInTheDocument();
      expect(messageTextArea).toHaveTextContent('Saved draft');
    });
  });
});
