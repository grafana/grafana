import { render, screen, within } from 'test/test-utils';

import { locationService, setAngularLoader } from '@grafana/runtime';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { DashboardModel } from '../../state/DashboardModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { AnnotationsSettings } from './AnnotationsSettings';

function setup(dashboard: DashboardModel, editIndex?: number) {
  const sectionNav = {
    main: { text: 'Dashboard' },
    node: {
      text: 'Annotations',
    },
  };

  return render(<AnnotationsSettings sectionNav={sectionNav} dashboard={dashboard} editIndex={editIndex} />);
}

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

  setupDataSources(...Object.values(dataSources));

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
    // we have a default build-in annotation
    dashboard = createDashboardModelFixture({
      id: 74,
      version: 7,
      annotations: {},
      links: [],
    });
  });

  test('it renders empty list cta if only builtIn annotation', async () => {
    setup(dashboard);

    expect(screen.queryByRole('grid')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /annotations & alerts \(built-in\) -- grafana --/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Add annotation query' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /annotations documentation/i })).toBeInTheDocument();
  });

  test('it renders empty list if annotations', async () => {
    dashboard.annotations.list = [];
    setup(dashboard);

    expect(screen.getByRole('button', { name: 'Add annotation query' })).toBeInTheDocument();
  });

  test('it renders the annotation names or uid if annotation does not exist', async () => {
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
    setup(dashboard);
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

    const { user } = setup(dashboard);

    // Check that we have sorting buttons
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'Move down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'Move up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'Move down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'Move up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();

    // Check the original order
    expect(within(getTableBodyRows()[0]).queryByText(/annotations & alerts/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByText(/annotation 2/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByText(/annotation 3/i)).toBeInTheDocument();

    await user.click(within(getTableBody()).getAllByRole('button', { name: 'Move down' })[0]);
    await user.click(within(getTableBody()).getAllByRole('button', { name: 'Move down' })[1]);
    await user.click(within(getTableBody()).getAllByRole('button', { name: 'Move up' })[0]);

    // Checking if it has changed the sorting accordingly
    expect(within(getTableBodyRows()[0]).queryByText(/annotation 3/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByText(/annotation 2/i)).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByText(/annotations & alerts/i)).toBeInTheDocument();
  });

  test('Adding a new annotation', async () => {
    const { user } = setup(dashboard);

    await user.click(screen.getByRole('button', { name: 'Add annotation query' }));

    expect(locationService.getSearchObject().editIndex).toBe('1');
    expect(dashboard.annotations.list.length).toBe(2);
  });

  test('Editing annotation', async () => {
    dashboard.annotations.list.push({
      name: 'New annotation query',
      datasource: { uid: 'uid2', type: 'testdata' },
      iconColor: 'red',
      enable: true,
    });

    const { user } = setup(dashboard, 1);

    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'My Prometheus Annotation');

    await user.click(screen.getByPlaceholderText(/testdata/i));

    expect(await screen.findByText(/Prometheus/i)).toBeVisible();
    expect(screen.queryAllByText(/testdata/i)).toHaveLength(1);

    await user.click(screen.getByText(/prometheus/i));

    expect(screen.getByRole('checkbox', { name: /hidden/i })).not.toBeChecked();
  });

  test('Deleting annotation', async () => {
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
    ];
    const { user } = setup(dashboard, 1); // Edit the not built-in annotations

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(locationService.getSearchObject().editIndex).toBe(undefined);
    expect(dashboard.annotations.list.length).toBe(1); // started with two
  });
});
