import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { RealDataDrilldownPage } from './RealDataDrilldownPage';
import { loadOverview } from './loadScenario';

jest.mock('./loadScenario', () => ({ loadOverview: jest.fn() }));

const expectDataSourcesButtonBesideHeading = () => {
  expect(screen.getByRole('heading', { level: 1, name: 'Drilldown' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Data sources' })).toBeInTheDocument();
};

afterEach(() => {
  jest.mocked(loadOverview).mockReset();
});

describe('RealDataDrilldownPage', () => {
  it('keeps the data sources button beside the heading while the overview loads', () => {
    jest.mocked(loadOverview).mockReturnValue(new Promise(() => {}));

    render(<RealDataDrilldownPage />);

    expect(screen.getByText('Querying the selected data sources')).toBeInTheDocument();
    expectDataSourcesButtonBesideHeading();
  });

  it('keeps the data sources button beside the heading when the overview fails to load', async () => {
    jest.mocked(loadOverview).mockRejectedValue(new Error('Tempo answered 502'));

    render(<RealDataDrilldownPage />);

    expect(await screen.findByText('Tempo answered 502')).toBeInTheDocument();
    expectDataSourcesButtonBesideHeading();
  });
});
