import { render, screen, fireEvent } from '@testing-library/react';

import { AdHocFiltersVariable, SceneVariableSet } from '@grafana/scenes';

import { DataTrailsRecentMetrics } from './DataTrailsRecentMetrics';
import { getTrailStore } from './TrailStore/TrailStore';
import { VAR_FILTERS } from './shared';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
}));

describe('DataTrailsRecentMetrics', () => {
  let scene: DataTrailsRecentMetricsProps;
  beforeEach(() => {
    const filtersVariable = new AdHocFiltersVariable({ name: VAR_FILTERS });
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
    }));
    scene = {
      variables: new SceneVariableSet({
        variables: [filtersVariable],
      }),
    } as DataTrailsRecentMetricsProps;
  });

  // TODO: test that..
  // renders the recent metrics header if there is at least one recent metric
  // does not show the "Show more" button if there are 3 or fewer recent metrics
  // shows the "Show more" button if there are more than 3 recent metrics
  // toggles between "Show more" and "Show less" when the button is clicked
  // truncates singular long label in recent explorations
  // truncates multiple labels, max of 3 lines
  // selecting a recent exploration card takes you to the metric
});
