import { render, screen, fireEvent } from '@testing-library/react';

import { AdHocFiltersVariable, sceneGraph, SceneObjectRef, SceneVariableSet } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { getTrailStore } from './TrailStore/TrailStore';
import { VAR_FILTERS } from './shared';

// jest.mock is like a magic import. when you start to see errors that are specific, that's when you mock it.
jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(), // where we mock the function
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

  // have to create scenario where there are more than 3 cards. in the UI i know how to do this. but to write it in a test, i need to know what's happening in the code.
  // we know there's a collection of recent explorations. we've set them up as an empty obj. when we pass empty obj as recent thing to component, the component is breaking.
  // TypeError: trail.resolve is not a functionJest - we need to know what DataTrailsHome requries all the way thru.

  // we need to figure out how to test a scene that is a child of a data trail and create a full data trail. because any time we do a lookup variable in a child scene, we need to set up the full trail because we need to access top level data trail filters.
  // when i debug for my next tests, try to create the object directly (for the props). i'll need to debug and find what the props need, OR read the type errors
  // when debugging, if i find there is no way to access that info (i.e., i'm running into a full data trail issue), just skip it for now. (like what's happening below).
  // const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail)!; - we're passing in the actual trail
  // the collection of recents are full trails. read errors, know that a full trail may need a full trail

  // // this test should likely be in the /DataTrailsRecentMetrics.test.tsx
  it('truncates singular long label in recent explorations', () => {
    // create a full DataTrail
    const trail = new DataTrail({});
    //
    function getFilterVar() {
      // a sceneGraph is
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
