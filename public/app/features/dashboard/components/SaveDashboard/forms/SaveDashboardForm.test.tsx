import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { byRole } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { Dashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { SaveDashboardResponseDTO } from 'app/types/dashboard';

import { SaveDashboardOptions } from '../types';

import { SaveDashboardForm } from './SaveDashboardForm';

const prepareDashboardMock = ({
  resetTimeSpy = jest.fn(),
  resetVarsSpy = jest.fn(),
  timeChanged,
  variableErrors = false,
  variableValuesChanged,
}: {
  timeChanged: boolean;
  variableValuesChanged: boolean;
  resetTimeSpy?: jest.Mock;
  resetVarsSpy?: jest.Mock;
  variableErrors?: boolean;
}) => {
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
    hasVariableErrors: jest.fn().mockReturnValue(variableErrors),
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

const ui = {
  variablesCheckbox: byRole('checkbox', { name: selectors.pages.SaveDashboardModal.saveVariables }),
  timeRangeCheckbox: byRole('checkbox', { name: selectors.pages.SaveDashboardModal.saveTimerange }),
};

describe('SaveDashboardAsForm', () => {
  describe('time and variables toggle rendering', () => {
    it('renders switches when variables or timerange', () => {
      render(
        <SaveDashboardForm
          isLoading={false}
          dashboard={prepareDashboardMock({ timeChanged: true, variableValuesChanged: true })}
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

      expect(ui.variablesCheckbox.get()).toBeInTheDocument();
      expect(ui.timeRangeCheckbox.get()).toBeInTheDocument();
    });

    it('should not render warning when there are no variable errors and variables checkbox is toggled', async () => {
      render(
        <SaveDashboardForm
          isLoading={false}
          dashboard={prepareDashboardMock({ timeChanged: false, variableValuesChanged: true })}
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
          options={{ saveVariables: true }}
          onOptionsChange={(opts: SaveDashboardOptions) => {
            return;
          }}
        />
      );

      expect(ui.variablesCheckbox.get()).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.variablesWarningAlert)).not.toBeInTheDocument(); // the alert shouldn't show as default
    });

    it('should render warning when there are variable errors and variables checkbox is toggled', async () => {
      render(
        <SaveDashboardForm
          isLoading={false}
          dashboard={prepareDashboardMock({ timeChanged: false, variableValuesChanged: true, variableErrors: true })}
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
          options={{ saveVariables: true }}
          onOptionsChange={(opts: SaveDashboardOptions) => {
            return;
          }}
        />
      );

      // when options.saveVariables === true then the alert should show
      expect(ui.variablesCheckbox.get()).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByTestId(selectors.pages.SaveDashboardModal.variablesWarningAlert)).toBeInTheDocument()
      );
    });
  });

  describe("when time and template vars haven't changed", () => {
    it("doesn't reset dashboard time and vars", async () => {
      const resetTimeSpy = jest.fn();
      const resetVarsSpy = jest.fn();
      const submitSpy = jest.fn();

      await renderAndSubmitForm(
        prepareDashboardMock({ timeChanged: false, variableValuesChanged: false, resetTimeSpy, resetVarsSpy }),
        submitSpy
      );

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
        await renderAndSubmitForm(
          prepareDashboardMock({ timeChanged: true, variableValuesChanged: true, resetTimeSpy, resetVarsSpy }),
          submitSpy
        );

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

      const messageTextArea = screen.getByPlaceholderText('Add a note to describe your changes.');

      expect(messageTextArea).toBeInTheDocument();
      expect(messageTextArea).toHaveTextContent('Saved draft');
    });
  });
});
