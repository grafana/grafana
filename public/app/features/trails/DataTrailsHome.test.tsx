import { render, screen } from '@testing-library/react';

import { AdHocFiltersVariable, sceneGraph, SceneObjectRef, SceneVariableSet } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { getTrailStore } from './TrailStore/TrailStore';
import { VAR_FILTERS } from './shared';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
}));

describe('DataTrailsHome', () => {
  let scene: DataTrailsHome;
  beforeEach(() => {
    const filtersVariable = new AdHocFiltersVariable({ name: VAR_FILTERS });
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
    }));
    scene = new DataTrailsHome({
      $variables: new SceneVariableSet({
        variables: [filtersVariable],
      }),
    });
  });

  it('renders the start button', () => {
    render(<scene.Component model={scene} />);
    expect(screen.getByText("Let's start!")).toBeInTheDocument();
  });

  it('renders the learn more button and checks its href', () => {
    render(<scene.Component model={scene} />);
    const learnMoreButton = screen.getByText('Learn more');
    expect(learnMoreButton).toBeInTheDocument();
    expect(learnMoreButton.closest('a')).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana/latest/explore/explore-metrics/'
    );
  });

  it('does not show recent metrics and bookmarks headers for first time user', () => {
    render(<scene.Component model={scene} />);
    expect(screen.queryByText('Or view a recent exploration')).not.toBeInTheDocument();
    expect(screen.queryByText('Or view bookmarks')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('truncates singular long label in recent explorations', () => {
    const trail = new DataTrail({});
    function getFilterVar() {
      const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error('getFilterVar failed');
    }
    const filtersVariable = getFilterVar();
    const longLabel = 'averylongalskdjlalsjflajkfklsajdfalskjdflkasjdflkadjf';
    filtersVariable.setState({
      filters: [{ key: 'zone', operator: '=', value: longLabel }],
    });
    const trailWithResolveMethod = new SceneObjectRef(trail);
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [trailWithResolveMethod],
    }));
    render(<scene.Component model={scene} />);
    expect(screen.getByText('...', { exact: false })).toBeInTheDocument();
  });
});
