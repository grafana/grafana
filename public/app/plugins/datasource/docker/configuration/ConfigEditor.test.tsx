import { render, screen } from '@testing-library/react';

import { ConfigEditor } from './ConfigEditor';
import { createConfigEditorProps } from '../mocks/datasource';

describe('Docker ConfigEditor', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(<ConfigEditor {...createConfigEditorProps()} />)
    ).not.toThrow();
  });

  it('renders connection settings section', () => {
    render(<ConfigEditor {...createConfigEditorProps()} />);

    expect(
      screen.getByPlaceholderText('http://localhost:2375')
    ).toBeInTheDocument();
  });

  it('renders authentication section', () => {
    render(<ConfigEditor {...createConfigEditorProps()} />);

    expect(
      screen.getByRole('heading', { name: 'Authentication' })
    ).toBeInTheDocument();
  });

  it('shows No Authentication option', () => {
    render(<ConfigEditor {...createConfigEditorProps()} />);

    expect(screen.getByText('No Authentication')).toBeInTheDocument();
  });
});
