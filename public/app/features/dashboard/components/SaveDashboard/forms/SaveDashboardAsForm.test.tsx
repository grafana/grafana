import React from 'react';
import { mount } from 'enzyme';
import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { DashboardModel } from 'app/features/dashboard/state';
import { act } from 'react-dom/test-utils';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]), search: jest.fn().mockResolvedValue([]) }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

jest.mock('app/features/plugins/datasource_srv', () => ({}));
jest.mock('app/features/expressions/ExpressionDatasource', () => ({}));

const prepareDashboardMock = (panel: any) => {
  const json = {
    title: 'name',
    panels: [panel],
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
    <SaveDashboardAsForm
      dashboard={dashboard as DashboardModel}
      onCancel={() => {}}
      onSuccess={() => {}}
      onSubmit={async jsonModel => {
        submitSpy(jsonModel);
        return {};
      }}
    />
  );

  await act(async () => {
    const button = container.find('button[aria-label="Save dashboard button"]');
    button.simulate('submit');
  });
};
describe('SaveDashboardAsForm', () => {
  describe('default values', () => {
    it('applies default dashboard properties', async () => {
      const spy = jest.fn();

      await renderAndSubmitForm(prepareDashboardMock({}), spy);

      expect(spy).toBeCalledTimes(1);
      const savedDashboardModel = spy.mock.calls[0][0];
      expect(savedDashboardModel.id).toBe(null);
      expect(savedDashboardModel.title).toBe('name Copy');
      expect(savedDashboardModel.editable).toBe(true);
      expect(savedDashboardModel.hideControls).toBe(false);
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
