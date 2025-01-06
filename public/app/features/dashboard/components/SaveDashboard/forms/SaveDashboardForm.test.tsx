import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardOptions } from '../types';

import { SaveDashboardForm } from './SaveDashboardForm';

const prepareDashboardMock = (
  timeChanged: boolean,
  variableValuesChanged: boolean,
  resetTimeSpy: jest.Mock,
  resetVarsSpy: jest.Mock
) => {
  const json: Dashboard = {
    title: 'name',
    id: 5,
    schemaVersion: 30,
  };

  return {
    ...json,
    meta: {},
    hasTimeChanged: jest.fn().mockReturnValue(timeChanged),
    hasVariablesChanged: jest.fn().mockReturnValue(variableValuesChanged),
    resetOriginalTime: () => resetTimeSpy(),
    resetOriginalVariables: () => resetVarsSpy(),
    getSaveModelClone: () => json,
  } as unknown as DashboardModel;
};

const renderAndSubmitForm = async (dashboard: DashboardModel, submitSpy: jest.Mock) => {
  render(
    <SaveDashboardForm
      isLoading={false}
      dashboard={dashboard}
      onCancel={() => {}}
      onSuccess={() => {}}
      onSubmit={async (jsonModel) => {
        submitSpy(jsonModel);
        return { status: 'success' } as SaveDashboardResponseDTO;
      }}
      saveModel={{
        clone: dashboard.getSaveModelClone(),
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
          isLoading={false}
          dashboard={prepareDashboardMock(true, true, jest.fn(), jest.fn())}
          onCancel={() => {}}
          onSuccess={() => {}}
          onSubmit={async () => {
            return {} as SaveDashboardResponseDTO;
          }}
          saveModel={{
            clone: { id: 1, schemaVersion: 3 },
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

      await renderAndSubmitForm(prepareDashboardMock(false, false, resetTimeSpy, resetVarsSpy), submitSpy);

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
        await renderAndSubmitForm(prepareDashboardMock(true, true, resetTimeSpy, resetVarsSpy), submitSpy);

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
          isLoading={false}
          dashboard={createDashboardModelFixture()}
          onCancel={() => {}}
          onSuccess={() => {}}
          onSubmit={async () => {
            return {} as SaveDashboardResponseDTO;
          }}
          saveModel={{
            clone: createDashboardModelFixture().getSaveModelClone(),
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
