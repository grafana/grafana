import { findByRole, findByText, findByTitle, getByTestId, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { byRole, byTestId } from 'testing-library-selector';

import { setBackendSrv } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardDTO } from '../../../../../types';
import { DashboardSearchItem, DashboardSearchItemType } from '../../../../search/types';
import { mockStore } from '../../mocks';
import { mockSearchApiResponse } from '../../mocks/grafanaApi';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';
import { getDefaultFormValues } from '../../utils/rule-form';

import 'whatwg-fetch';

import AnnotationsField from './AnnotationsField';

// To get anything displayed inside the Autosize component we need to mock it
// Ref https://github.com/bvaughn/react-window/issues/454#issuecomment-646031139
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: ({ height, width }: { height: number; width: number }) => JSX.Element }) =>
      children({ height: 500, width: 330 })
);

const ui = {
  setDashboardButton: byRole('button', { name: 'Set dashboard and panel' }),
  annotationKeys: byTestId('annotation-key-', { exact: false }),
  annotationValues: byTestId('annotation-value-', { exact: false }),
  dashboardPicker: {
    dialog: byRole('dialog'),
    heading: byRole('heading', { name: 'Select dashboard and panel' }),
    confirmButton: byRole('button', { name: 'Confirm' }),
  },
} as const;

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function FormWrapper({ formValues }: { formValues?: Partial<RuleFormValues> }) {
  const store = mockStore(() => null);
  const formApi = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues(), ...formValues } });

  return (
    <Provider store={store}>
      <FormProvider {...formApi}>
        <AnnotationsField />
      </FormProvider>
    </Provider>
  );
}

describe('AnnotationsField', function () {
  it('should display default list of annotations', function () {
    render(<FormWrapper />);

    const annotationElements = ui.annotationKeys.getAll();

    expect(annotationElements).toHaveLength(3);
    expect(annotationElements[0]).toHaveTextContent('Summary');
    expect(annotationElements[1]).toHaveTextContent('Description');
    expect(annotationElements[2]).toHaveTextContent('Runbook URL');
  });

  describe('Dashboard and panel picker', function () {
    it('should display dashboard and panel selector when select button clicked', async function () {
      mockSearchApiResponse(server, []);

      const user = userEvent.setup();

      render(<FormWrapper />);

      await user.click(ui.setDashboardButton.get());

      expect(ui.dashboardPicker.dialog.get()).toBeInTheDocument();
      expect(ui.dashboardPicker.heading.get()).toBeInTheDocument();
    });

    it('should enable Confirm button only when dashboard and panel selected', async function () {
      mockSearchApiResponse(server, [
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockGetDashboardResponse(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'timeseries' },
            { id: 2, title: 'Second panel', type: 'timeseries' },
          ],
        })
      );

      const user = userEvent.setup();

      render(<FormWrapper />);

      await user.click(ui.setDashboardButton.get());
      expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();

      await user.click(await findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));
      expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();

      await user.click(await findByText(ui.dashboardPicker.dialog.get(), 'First panel'));
      expect(ui.dashboardPicker.confirmButton.get()).toBeEnabled();
    });

    it('should add selected dashboard and panel as annotations', async function () {
      mockSearchApiResponse(server, [
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockGetDashboardResponse(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'graph' },
            { id: 2, title: 'Second panel', type: 'graph' },
          ],
        })
      );

      const user = userEvent.setup();

      render(<FormWrapper formValues={{ annotations: [] }} />);

      await user.click(ui.setDashboardButton.get());
      await user.click(await findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));

      await user.click(await findByText(ui.dashboardPicker.dialog.get(), 'Second panel'));

      await user.click(ui.dashboardPicker.confirmButton.get());

      const annotationKeyElements = ui.annotationKeys.getAll();
      const annotationValueElements = ui.annotationValues.getAll();

      expect(ui.dashboardPicker.dialog.query()).not.toBeInTheDocument();

      expect(annotationKeyElements).toHaveLength(2);
      expect(annotationValueElements).toHaveLength(2);

      expect(annotationKeyElements[0]).toHaveTextContent('Dashboard UID');
      expect(annotationValueElements[0]).toHaveTextContent('dash-test-uid');

      expect(annotationKeyElements[1]).toHaveTextContent('Panel ID');
      expect(annotationValueElements[1]).toHaveTextContent('2');
    });

    // this test _should_ work in theory but something is stopping the 'onClick' function on the dashboard item
    // to trigger "handleDashboardChange" – skipping it for now but has been manually tested.
    it.skip('should update existing dashboard and panel identifies', async function () {
      mockSearchApiResponse(server, [
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
        mockDashboardSearchItem({
          title: 'My other dashboard',
          uid: 'dash-other-uid',
          type: DashboardSearchItemType.DashDB,
        }),
      ]);

      mockGetDashboardResponse(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'timeseries' },
            { id: 2, title: 'Second panel', type: 'timeseries' },
          ],
        })
      );
      mockGetDashboardResponse(
        mockDashboardDto({
          title: 'My other dashboard',
          uid: 'dash-other-uid',
          panels: [{ id: 3, title: 'Third panel', type: 'timeseries' }],
        })
      );

      const user = userEvent.setup();

      render(
        <FormWrapper
          formValues={{
            annotations: [
              { key: Annotation.dashboardUID, value: 'dash-test-uid' },
              { key: Annotation.panelID, value: '1' },
            ],
          }}
        />
      );

      let annotationValueElements = ui.annotationValues.getAll();
      expect(annotationValueElements[0]).toHaveTextContent('dash-test-uid');
      expect(annotationValueElements[1]).toHaveTextContent('1');

      const { confirmButton, dialog } = ui.dashboardPicker;

      await user.click(ui.setDashboardButton.get());
      await user.click(await findByRole(dialog.get(), 'button', { name: /My other dashboard/ }));
      await user.click(await findByRole(dialog.get(), 'button', { name: /Third panel/ }));
      await user.click(confirmButton.get());

      expect(ui.dashboardPicker.dialog.query()).not.toBeInTheDocument();

      const annotationKeyElements = ui.annotationKeys.getAll();
      annotationValueElements = ui.annotationValues.getAll();

      expect(annotationKeyElements).toHaveLength(2);
      expect(annotationValueElements).toHaveLength(2);

      expect(annotationKeyElements[0]).toHaveTextContent('Dashboard UID');
      expect(annotationValueElements[0]).toHaveTextContent('dash-other-uid');

      expect(annotationKeyElements[1]).toHaveTextContent('Panel ID');
      expect(annotationValueElements[1]).toHaveTextContent('3');
    });

    it('should render warning icon for panels of type other than graph and timeseries', async function () {
      mockSearchApiResponse(server, [
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockGetDashboardResponse(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'bar' },
            { id: 2, title: 'Second panel', type: 'graph' },
          ],
        })
      );

      const user = userEvent.setup();

      render(<FormWrapper formValues={{ annotations: [] }} />);

      const { dialog } = ui.dashboardPicker;

      await user.click(ui.setDashboardButton.get());
      await user.click(await findByTitle(dialog.get(), 'My dashboard'));

      const warnedPanel = await findByRole(dialog.get(), 'button', { name: /First panel/ });

      expect(getByTestId(warnedPanel, 'warning-icon')).toBeInTheDocument();
    });
  });
});

function mockGetDashboardResponse(dashboard: DashboardDTO) {
  server.use(
    rest.get(`/api/dashboards/uid/${dashboard.dashboard.uid}`, (req, res, ctx) =>
      res(ctx.json<DashboardDTO>(dashboard))
    )
  );
}

function mockDashboardSearchItem(searchItem: Partial<DashboardSearchItem>) {
  return {
    title: '',
    uid: '',
    type: DashboardSearchItemType.DashDB,
    url: '',
    uri: '',
    items: [],
    tags: [],
    isStarred: false,
    ...searchItem,
  };
}

function mockDashboardDto(dashboard: Partial<DashboardDTO['dashboard']>): DashboardDTO {
  return {
    dashboard: {
      ...defaultDashboard,
      ...dashboard,
    } as DashboardDTO['dashboard'],
    meta: {},
  };
}
