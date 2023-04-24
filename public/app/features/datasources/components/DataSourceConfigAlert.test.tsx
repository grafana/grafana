import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';

import { DataSourceConfigAlert, Props, createDashboardLinkText, exploreDataLinkText } from './DataSourceConfigAlert';

const setup = (props?: Partial<Props>) => {
  return render(
    <Router history={locationService.getHistory()}>
      <DataSourceConfigAlert
        title="Success"
        severity="success"
        exploreUrl={'/explore'}
        canExploreDataSources={true}
        dataSourceId="1234abcde"
        onDashboardLinkClicked={jest.fn()}
        {...props}
      />
    </Router>
  );
};

describe('DataSourceConfigAlert', () => {
  it('shows the message links for success severity', () => {
    setup();

    expect(screen.getByText(createDashboardLinkText)).toBeInTheDocument();
  });

  it('explore link is rendered disabled when user doesn`t have privileges', () => {
    setup({ canExploreDataSources: false });

    expect(screen.getByText(exploreDataLinkText)).toHaveClass('test-disabled');
  });
});
