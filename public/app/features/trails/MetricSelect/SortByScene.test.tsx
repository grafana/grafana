import { render, screen, waitFor } from '@testing-library/react';
import { select } from 'react-select-event';

import { SortByScene, SortCriteriaChanged } from './SortByScene';

describe('SortByScene', () => {
  let scene: SortByScene;
  beforeEach(() => {
    localStorage.clear();
    scene = new SortByScene({ target: 'fields' });
  });

  test('Sorts by standard deviation by default', () => {
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Most relevant')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  test('Retrieves stored sorting preferences', () => {
    // setSortByPreference('fields', 'alphabetical', 'asc');

    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Asc')).toBeInTheDocument();
  });

  test('Reports criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort by'), 'Highest spike', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', 'max', 'desc'), true);
  });

  test('Reports criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort direction'), 'Asc', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('fields', 'changepoint', 'asc'), true);
  });
});
