import React from 'react';
import { shallow } from 'enzyme';
import DashboardsTable, { Props } from './DashboardsTable';
import { PluginDashboard } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    dashboards: [] as PluginDashboard[],
    onImport: jest.fn(),
    onRemove: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<DashboardsTable {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render table', () => {
    const wrapper = setup({
      dashboards: [
        {
          dashboardId: 0,
          description: '',
          folderId: 0,
          imported: false,
          importedRevision: 0,
          importedUri: '',
          importedUrl: '',
          path: 'dashboards/carbon_metrics.json',
          pluginId: 'graphite',
          removed: false,
          revision: 1,
          slug: '',
          title: 'Graphite Carbon Metrics',
        },
        {
          dashboardId: 0,
          description: '',
          folderId: 0,
          imported: true,
          importedRevision: 0,
          importedUri: '',
          importedUrl: '',
          path: 'dashboards/carbon_metrics.json',
          pluginId: 'graphite',
          removed: false,
          revision: 1,
          slug: '',
          title: 'Graphite Carbon Metrics',
        },
      ],
    });

    expect(wrapper).toMatchSnapshot();
  });
});
