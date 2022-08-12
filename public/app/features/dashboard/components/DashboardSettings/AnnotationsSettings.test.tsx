import { within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, setAngularLoader, setDataSourceSrv } from '@grafana/runtime';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';

import { DashboardModel } from '../../state';

import { AnnotationsSettings } from './AnnotationsSettings';

describe('AnnotationsSettings', () => {
  let dashboard: DashboardModel;

  const dataSources = {
    grafana: mockDataSource(
      {
        name: 'Grafana',
        uid: 'uid1',
        type: 'grafana',
      },
      { annotations: true }
    ),
    Testdata: mockDataSource(
      {
        name: 'Testdata',
        uid: 'uid2',
        type: 'testdata',
        isDefault: true,
      },
      { annotations: true }
    ),
    Prometheus: mockDataSource(
      {
        name: 'Prometheus',
        uid: 'uid3',
        type: 'prometheus',
      },
      { annotations: true }
    ),
  };

  setDataSourceSrv(new MockDataSourceSrv(dataSources));

  const getTableBody = () => screen.getAllByRole('rowgroup')[1];
  const getTableBodyRows = () => within(getTableBody()).getAllByRole('row');

  beforeAll(() => {
    setAngularLoader({
      load: () => ({
        destroy: jest.fn(),
        digest: jest.fn(),
        getScope: () => ({ $watch: () => {} }),
      }),
    });
  });

  beforeEach(() => {
    dashboard = new DashboardModel({
      id: 74,
      version: 7,
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: { uid: 'uid1', type: 'grafana' },
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      links: [],
    });
  });

  test('it renders a header and cta if no annotations or only builtIn annotation', async () => {
    const { rerender } = render(<AnnotationsSettings dashboard={dashboard} />);

    expect(screen.queryByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /annotations & alerts \(built\-in\) grafana/i })).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /annotations documentation/i })).toBeInTheDocument();

    dashboard.annotations.list[0].name = 'My annotation';
    rerender(<AnnotationsSettings dashboard={dashboard} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /my annotation \(built\-in\) grafana/i })).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new query/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByLabelText(/Delete query with title/)[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryAllByRole('row').length).toBe(0);
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
  });

  test('it renders the annotation names or uid if annotation doesnt exist', async () => {
    dashboard.annotations.list = [
      ...dashboard.annotations.list,
      {
        builtIn: 0,
        datasource: { uid: 'uid3', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 2',
        type: 'dashboard',
      },
      {
        builtIn: 0,
        datasource: { uid: 'deletedAnnotationId', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 2',
        type: 'dashboard',
      },
    ];

    render(<AnnotationsSettings dashboard={dashboard} />);
    // Check that we have the correct annotations
    expect(screen.queryByText(/prometheus/i)).toBeInTheDocument();
    expect(screen.queryByText(/deletedAnnotationId/i)).toBeInTheDocument();
  });

  test('it renders a sortable table of annotations', async () => {
    dashboard.annotations.list = [
      ...dashboard.annotations.list,
      {
        builtIn: 0,
        datasource: { uid: 'uid3', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 2',
        type: 'dashboard',
      },
      {
        builtIn: 0,
        datasource: { uid: 'uid3', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 3',
        type: 'dashboard',
      },
    ];

    render(<AnnotationsSettings dashboard={dashboard} />);

    // Check that we have sorting buttons
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'arrow-up' })).not.toBeInTheDocument();
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'arrow-down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'arrow-up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'arrow-down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'arrow-up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'arrow-down' })).not.toBeInTheDocument();

    // Check the original order
    expect(within(getTableBodyRows()[0]).queryByText(/annotations & alerts/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByText(/annotation 2/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByText(/annotation 3/i)).toBeInTheDocument();

    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[0]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[1]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-up' })[0]);

    // Checking if it has changed the sorting accordingly
    expect(within(getTableBodyRows()[0]).queryByText(/annotation 3/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByText(/annotation 2/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByText(/annotations & alerts/i)).toBeInTheDocument();
  });

  test('Adding a new annotation', async () => {
    render(<AnnotationsSettings dashboard={dashboard} />);

    await userEvent.click(screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query')));

    expect(locationService.getSearchObject().editIndex).toBe('1');
    expect(dashboard.annotations.list.length).toBe(2);
  });

  test('Editing annotations', async () => {
    dashboard.annotations.list.push({
      name: 'New annotation query',
      datasource: { uid: 'uid2', type: 'testdata' },
      iconColor: 'red',
      enable: true,
    });

    render(<AnnotationsSettings dashboard={dashboard} editIndex={1} />);

    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My Prometheus Annotation');

    await userEvent.click(screen.getByText(/testdata/i));

    expect(await screen.findByText(/Prometheus/i)).toBeVisible();
    expect(screen.queryAllByText(/testdata/i)).toHaveLength(2);

    await userEvent.click(screen.getByText(/prometheus/i));

    expect(screen.getByRole('checkbox', { name: /hidden/i })).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(locationService.getSearchObject().editIndex).toBe(undefined);
    expect(dashboard.annotations.list.length).toBe(1);
  });
});
