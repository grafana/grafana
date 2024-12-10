import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, within } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { DashboardSearchItemType } from '../../../../search/types';
import { mockDashboardApi, setupMswServer } from '../../mockApi';
import { mockDashboardDto, mockDashboardSearchItem } from '../../mocks';
import { RuleFormValues } from '../../types/rule-form';
import { Annotation } from '../../utils/constants';
import { getDefaultFormValues } from '../../utils/rule-form';

import AnnotationsStep from './AnnotationsStep';

// To get anything displayed inside the Autosize component we need to mock it
// Ref https://github.com/bvaughn/react-window/issues/454#issuecomment-646031139
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: ({ height, width }: { height: number; width: number }) => JSX.Element }) =>
      children({ height: 500, width: 330 })
);

const ui = {
  setDashboardButton: byRole('button', { name: 'Link dashboard and panel' }),
  annotationKeys: byTestId('annotation-key-', { exact: false }),
  annotationValues: byTestId('annotation-value-', { exact: false }),
  dashboardAnnotation: byTestId('dashboard-annotation'),
  panelAnnotation: byTestId('panel-annotation'),
  dashboardPicker: {
    dialog: byRole('dialog'),
    heading: byRole('heading', { name: 'Select dashboard and panel' }),
    confirmButton: byRole('button', { name: 'Confirm' }),
  },
} as const;

const server = setupMswServer();

function FormWrapper({ formValues }: { formValues?: Partial<RuleFormValues> }) {
  const formApi = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues(), ...formValues } });

  return (
    <FormProvider {...formApi}>
      <AnnotationsStep />
    </FormProvider>
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
      mockDashboardApi(server).search([]);

      const user = userEvent.setup();

      render(<FormWrapper />);

      await user.click(ui.setDashboardButton.get());

      expect(ui.dashboardPicker.dialog.get()).toBeInTheDocument();
      expect(ui.dashboardPicker.heading.get()).toBeInTheDocument();
    });

    it('should enable Confirm button only when dashboard and panel selected', async function () {
      mockDashboardApi(server).search([
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockDashboardApi(server).dashboard(
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

      await user.click(await screen.findByTitle('My dashboard'));
      expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();

      await user.click(await screen.findByText('First panel'));
      expect(ui.dashboardPicker.confirmButton.get()).toBeEnabled();
    });

    it('should add selected dashboard and panel as annotations', async function () {
      mockDashboardApi(server).search([
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockDashboardApi(server).dashboard(
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
      await user.click(await screen.findByTitle('My dashboard'));

      await user.click(await screen.findByText('Second panel'));

      await user.click(ui.dashboardPicker.confirmButton.get());

      const annotationValueElements = ui.annotationValues.getAll();

      expect(ui.dashboardPicker.dialog.query()).not.toBeInTheDocument();

      expect(annotationValueElements).toHaveLength(2);
      expect(annotationValueElements[0]).toHaveTextContent('dash-test-uid');
      expect(annotationValueElements[1]).toHaveTextContent('2');
    });

    it('should not show rows as panels', async function () {
      mockDashboardApi(server).search([
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockDashboardApi(server).dashboard(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'Row panel', type: 'row' },
            { id: 2, title: 'First panel', type: 'timeseries' },
          ],
        })
      );

      const user = userEvent.setup();

      render(<FormWrapper />);

      await user.click(ui.setDashboardButton.get());
      expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();

      await user.click(await screen.findByTitle('My dashboard'));

      expect(await screen.findByText('First panel')).toBeInTheDocument();
      expect(screen.queryByText('Row panel')).not.toBeInTheDocument();
    });

    it('should show panels within collapsed rows', async function () {
      mockDashboardApi(server).search([
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
      ]);

      mockDashboardApi(server).dashboard(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'timeseries' },
            {
              id: 2,
              title: 'Row panel',
              collapsed: true,
              type: 'row',
              panels: [{ id: 3, title: 'Panel within collapsed row', type: 'timeseries' }],
            },
          ],
        })
      );

      const user = userEvent.setup();

      render(<FormWrapper />);

      await user.click(ui.setDashboardButton.get());
      expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();

      await user.click(await screen.findByTitle('My dashboard'));

      expect(await screen.findByText('First panel')).toBeInTheDocument();
      expect(screen.queryByText('Row panel')).not.toBeInTheDocument();
      expect(await screen.findByText('Panel within collapsed row')).toBeInTheDocument();
    });

    // this test _should_ work in theory but something is stopping the 'onClick' function on the dashboard item
    // to trigger "handleDashboardChange" – skipping it for now but has been manually tested.
    it.skip('should update existing dashboard and panel identifies', async function () {
      mockDashboardApi(server).search([
        mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
        mockDashboardSearchItem({
          title: 'My other dashboard',
          uid: 'dash-other-uid',
          type: DashboardSearchItemType.DashDB,
        }),
      ]);

      mockDashboardApi(server).dashboard(
        mockDashboardDto({
          title: 'My dashboard',
          uid: 'dash-test-uid',
          panels: [
            { id: 1, title: 'First panel', type: 'timeseries' },
            { id: 2, title: 'Second panel', type: 'timeseries' },
          ],
        })
      );
      mockDashboardApi(server).dashboard(
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

      const { confirmButton } = ui.dashboardPicker;

      await user.click(ui.setDashboardButton.get());
      await user.click(await screen.findByRole('button', { name: /My other dashboard/ }));
      await user.click(await screen.findByRole('button', { name: /Third panel/ }));
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
  });

  it('should render warning icon for panels of type other than graph and timeseries', async function () {
    mockDashboardApi(server).search([
      mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
    ]);

    mockDashboardApi(server).dashboard(
      mockDashboardDto({
        title: 'My dashboard',
        uid: 'dash-test-uid',
        panels: [
          { id: 1, title: 'First panel', type: 'bar' },
          { id: 2, title: 'Second panel', type: 'graph' },
          { type: 'timeseries' }, // Panels might NOT have id and title fields
        ],
      })
    );

    const user = userEvent.setup();

    render(<FormWrapper formValues={{ annotations: [] }} />);

    await user.click(ui.setDashboardButton.get());
    await user.click(await screen.findByTitle('My dashboard'));

    const warnedPanel = await screen.findByRole('button', { name: /First panel/ });

    expect(within(warnedPanel).getByTestId('warning-icon')).toBeInTheDocument();
  });

  it('should render when panels do not contain certain fields', async () => {
    mockDashboardApi(server).search([
      mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
    ]);

    mockDashboardApi(server).dashboard(
      mockDashboardDto({
        title: 'My dashboard',
        uid: 'dash-test-uid',
        panels: [{ type: 'row' }, { type: 'timeseries' }, { id: 4, type: 'graph' }, { title: 'Graph', type: 'graph' }],
      })
    );

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

    expect(await ui.dashboardAnnotation.find()).toBeInTheDocument();
    expect(ui.dashboardAnnotation.get()).toHaveTextContent('My dashboard');
    expect(ui.panelAnnotation.query()).not.toBeInTheDocument();
  });
});
