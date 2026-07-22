import { screen, waitFor } from '@testing-library/react';

import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { renderWithQueryEditorProvider } from '../testUtils';

import { TransformationTypePicker } from './TransformationTypePicker';

describe('TransformationTypePicker', () => {
  standardTransformersRegistry.setInit(getStandardTransformers);

  it('renders a search input and the transformation cards', () => {
    renderWithQueryEditorProvider(<TransformationTypePicker />);

    expect(screen.getByPlaceholderText('Search for transformation')).toBeInTheDocument();
    expect(screen.getByText('Reduce')).toBeInTheDocument();
  });

  it('announces search results to screen readers via a live region', async () => {
    const { user } = renderWithQueryEditorProvider(<TransformationTypePicker />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    const search = screen.getByPlaceholderText('Search for transformation');
    await user.type(search, 'reduce');

    await waitFor(() => expect(status).toHaveTextContent(/\d+ transformations? found/));

    await user.clear(search);
    await user.type(search, 'this matches nothing');

    await waitFor(() => expect(status).toHaveTextContent('No transformations found'));
  });
});
