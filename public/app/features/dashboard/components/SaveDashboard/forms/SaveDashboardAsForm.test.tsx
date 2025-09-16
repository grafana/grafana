import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { SaveDashboardResponseDTO } from 'app/types/dashboard';

import { SaveDashboardAsForm, SaveDashboardAsFormProps } from './SaveDashboardAsForm';

jest.mock('app/features/plugins/datasource_srv', () => ({}));
jest.mock('app/features/expressions/ExpressionDatasource', () => ({}));
jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: {
    validateNewDashboardName: () => true,
  },
}));

const prepareDashboardMock = (panel: object) => {
  const json = {
    title: 'name',
    panels: [panel],
    tags: ['tag1', 'tag2'],
  };

  return {
    id: 5,
    meta: {},
    ...json,
    getSaveModelClone: () => json,
  };
};
const renderAndSubmitForm = async (
  dashboard: unknown,
  submitSpy: jest.Mock,
  otherProps: Partial<SaveDashboardAsFormProps> = {}
) => {
  render(
    <SaveDashboardAsForm
      isLoading={false}
      dashboard={dashboard as DashboardModel}
      onCancel={() => {}}
      onSuccess={() => {}}
      onSubmit={async (jsonModel) => {
        submitSpy(jsonModel);
        return {} as SaveDashboardResponseDTO;
      }}
      {...otherProps}
    />
  );

  const button = screen.getByRole('button', { name: 'Save dashboard button' });
  await userEvent.click(button);
};
describe('SaveDashboardAsForm', () => {
  describe('default values', () => {
    it('applies default dashboard properties', async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock({}), spy, {
        isNew: true,
      });

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.id).toBe(null);
      expect(savedDashboardModel.title).toBe('name');
      expect(savedDashboardModel.editable).toBe(true);
      expect(savedDashboardModel.tags).toEqual(['tag1', 'tag2']);
    });

    it("appends 'Copy' to the name when the dashboard isnt new", async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock({}), spy, {
        isNew: false,
      });

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.title).toBe('name Copy');
      // when copying a dashboard, the tags should be empty
      expect(savedDashboardModel.tags).toEqual([]);
    });
  });

  describe('graph panel', () => {
    const panel = {
      id: 1,
      type: 'graph',
      alert: { rule: 1 },
      thresholds: { value: 3000 },
    };

    it('should remove alerts and thresholds from  panel', async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock(panel), spy);

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.panels[0]).toEqual({ id: 1, type: 'graph' });
    });
  });

  describe('singestat panel', () => {
    const panel = { id: 1, type: 'singlestat', thresholds: { value: 3000 } };

    it('should keep thresholds', async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock(panel), spy);

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
    });
  });

  describe('table panel', () => {
    const panel = { id: 1, type: 'table', thresholds: { value: 3000 } };

    it('should keep thresholds', async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock(panel), spy);

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
    });
  });
});
