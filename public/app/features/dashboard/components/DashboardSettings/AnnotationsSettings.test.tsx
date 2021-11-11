import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';
import { setAngularLoader, setDataSourceSrv } from '@grafana/runtime';
import { AnnotationsSettings } from './AnnotationsSettings';

describe('AnnotationsSettings', () => {
  let dashboard: any;
  const datasources: Record<string, any> = {
    Grafana: {
      name: 'Grafana',
      meta: {
        type: 'datasource',
        name: 'Grafana',
        id: 'grafana',
        info: {
          logos: {
            small: 'public/img/icn-datasource.svg',
          },
        },
      },
    },
    Testdata: {
      name: 'Testdata',
      id: 4,
      meta: {
        type: 'datasource',
        name: 'TestData',
        id: 'testdata',
        info: {
          logos: {
            small: 'public/app/plugins/datasource/testdata/img/testdata.svg',
          },
        },
      },
    },
    Prometheus: {
      name: 'Prometheus',
      id: 33,
      meta: {
        type: 'datasource',
        name: 'Prometheus',
        id: 'prometheus',
        info: {
          logos: {
            small: 'public/app/plugins/datasource/prometheus/img/prometheus_logo.svg',
          },
        },
      },
    },
  };

  const getTableBody = () => screen.getAllByRole('rowgroup')[1];
  const getTableBodyRows = () => within(getTableBody()).getAllByRole('row');

  beforeAll(() => {
    setDataSourceSrv({
      getList() {
        return Object.values(datasources).map((d) => d);
      },
      getInstanceSettings(name: string) {
        return name
          ? {
              name: datasources[name].name,
              value: datasources[name].name,
              meta: datasources[name].meta,
            }
          : {
              name: datasources.Testdata.name,
              value: datasources.Testdata.name,
              meta: datasources.Testdata.meta,
            };
      },
      get(name: string) {
        return Promise.resolve(name ? datasources[name] : datasources.Testdata);
      },
    } as any);

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
            datasource: 'Grafana',
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
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add annotation query'))
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
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add annotation query'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new query/i })).not.toBeInTheDocument();

    userEvent.click(screen.getAllByLabelText(/Delete query with title/)[0]);
    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryAllByRole('row').length).toBe(0);
    expect(
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add annotation query'))
    ).toBeInTheDocument();
  });

  test('it renders a sortable table of annotations', () => {
    const annotationsList = [
      ...dashboard.annotations.list,
      {
        builtIn: 0,
        datasource: 'Prometheus',
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotation 2',
        type: 'dashboard',
      },
      {
        builtIn: 0,
        datasource: 'Prometheus',
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

  test('it renders a form for adding/editing annotations', () => {
    render(<AnnotationsSettings dashboard={dashboard} />);

    userEvent.click(screen.getByLabelText(selectors.components.CallToActionCard.button('Add annotation query')));

    const heading = screen.getByRole('heading', {
      name: /annotations edit/i,
    });
    const nameInput = screen.getByRole('textbox', { name: /name/i });

    expect(heading).toBeInTheDocument();

    userEvent.clear(nameInput);
    userEvent.type(nameInput, 'My Prometheus Annotation');

    userEvent.click(screen.getByText(/testdata/i));

    expect(screen.queryByText(/prometheus/i)).toBeVisible();
    expect(screen.queryAllByText(/testdata/i)).toHaveLength(2);

    userEvent.click(screen.getByText(/prometheus/i));

    expect(screen.getByRole('checkbox', { name: /hidden/i })).not.toBeChecked();

    userEvent.click(within(heading).getByText(/annotations/i));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(2);
    expect(screen.queryByRole('row', { name: /my prometheus annotation prometheus/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new query/i })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add annotation query'))
    ).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: /new query/i }));

    userEvent.click(within(screen.getByRole('heading', { name: /annotations edit/i })).getByText(/annotations/i));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(3);

    userEvent.click(screen.getAllByLabelText(/Delete query with title/)[0]);
    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(2);
  });
});
