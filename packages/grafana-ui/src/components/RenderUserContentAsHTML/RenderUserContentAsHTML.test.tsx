import { render, screen } from '@testing-library/react';
import React from 'react';

import { RenderUserContentAsHTML } from './RenderUserContentAsHTML';

describe('RenderUserContentAsHTML', () => {
  it('should render html content', () => {
    render(<RenderUserContentAsHTML content='<a href="#">sample content</a>' />);
    expect(screen.getByRole('link', { name: /sample content/ })).toBeInTheDocument();
  });
  it('should render a raw string content', () => {
    render(<RenderUserContentAsHTML content="sample content" />);
    expect(screen.getByText(/sample content/)).toBeInTheDocument();
  });
});
