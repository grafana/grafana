import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { setAngularLoader, setDataSourceSrv } from '@grafana/runtime';
import { AnnotationsSettings } from './AnnotationsSettings';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';

describe('AnnotationsSettings', () => {
  let dashboard: any;

  const dataSources = {
    grafana: mockDataSource(
      {
        name: 'Grafana',
        uid: 'Grafana',
        type: 'grafana',
        isDefault: true,
      },
      { annotations: true }
    ),
    Testdata: mockDataSource(
      {
        name: 'Testdata',
        uid: 'Testdata',
        type: 'testdata',
        isDefault: true,
      },
      { annotations: true }
    ),
    Prometheus: mockDataSource(
      {
        name: 'Prometheus',
        uid: 'Prometheus',
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
    dashboard = {
      id: 74,
      version: 7,
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: { uid: 'Grafana', type: 'grafana' },
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      links: [],
    };
  });

  test('it renders a header and cta if no annotations or only builtIn annotation', () => {
    render(<AnnotationsSettings dashboard={dashboard} />);

    expect(screen.getByRole('heading', { name: /annotations/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /annotations & alerts \(built\-in\) grafana/i })).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /annotations documentation/i })).toBeInTheDocument();

    userEvent.click(screen.getByRole('cell', { name: /annotations & alerts \(built\-in\)/i }));

    const heading = screen.getByRole('heading', {
      name: /annotations edit/i,
    });
    const nameInput = screen.getByRole('textbox', { name: /name/i });

    expect(heading).toBeInTheDocument();

    userEvent.clear(nameInput);
    userEvent.type(nameInput, 'My Annotation');

    expect(screen.queryByText(/grafana/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /hidden/i })).toBeChecked();

    userEvent.click(within(heading).getByText(/annotations/i));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /my annotation \(built\-in\) grafana/i })).toBeInTheDocument();
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new query/i })).not.toBeInTheDocument();

    userEvent.click(screen.getAllByLabelText(/Delete query with title/)[0]);
    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryAllByRole('row').length).toBe(0);
    expect(
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).toBeInTheDocument();
  });

  test('it renders a sortable table of annotations', () => {
    const annotationsList = [
      ...dashboard.annotations.list,
      {
        builtIn: 0,
        datasource: { uid: 'Prometheus', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 2',
        type: 'dashboard',
      },
      {
        builtIn: 0,
        datasource: { uid: 'Prometheus', type: 'prometheus' },
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 3',
        type: 'dashboard',
      },
    ];
    const dashboardWithAnnotations = {
      ...dashboard,
      annotations: {
        list: [...annotationsList],
      },
    };
    render(<AnnotationsSettings dashboard={dashboardWithAnnotations} />);
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

    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[0]);
    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[1]);
    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-up' })[0]);

    // Checking if it has changed the sorting accordingly
    expect(within(getTableBodyRows()[0]).queryByText(/annotation 3/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByText(/annotation 2/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByText(/annotations & alerts/i)).toBeInTheDocument();
  });

  test('it renders a form for adding/editing annotations', async () => {
    render(<AnnotationsSettings dashboard={dashboard} />);

    userEvent.click(screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query')));

    const heading = screen.getByRole('heading', {
      name: /annotations edit/i,
    });
    const nameInput = screen.getByRole('textbox', { name: /name/i });

    expect(heading).toBeInTheDocument();

    userEvent.clear(nameInput);
    userEvent.type(nameInput, 'My Prometheus Annotation');

    userEvent.click(screen.getByText(/testdata/i));

    expect(await screen.findByText(/Prometheus/i)).toBeVisible();
    expect(screen.queryAllByText(/testdata/i)).toHaveLength(2);

    userEvent.click(screen.getByText(/prometheus/i));

    expect(screen.getByRole('checkbox', { name: /hidden/i })).not.toBeChecked();

    userEvent.click(within(heading).getByText(/annotations/i));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(2);
    expect(screen.queryByRole('row', { name: /my prometheus annotation prometheus/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new query/i })).toBeInTheDocument();
    expect(
      screen.queryByTestId(selectors.components.CallToActionCard.buttonV2('Add annotation query'))
    ).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /new query/i }));

    userEvent.click(within(screen.getByRole('heading', { name: /annotations edit/i })).getByText(/annotations/i));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(3);

    userEvent.click(screen.getAllByLabelText(/Delete query with title/)[0]);
    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(2);
  });
});
