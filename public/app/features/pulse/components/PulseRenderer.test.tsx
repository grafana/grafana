import { render, screen } from '@testing-library/react';

import { type PulseBody } from '../types';

import { PulseRenderer } from './PulseRenderer';

describe('PulseRenderer', () => {
  it('renders plain text via React data binding', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'hello world' }] }],
      },
    };
    render(<PulseRenderer body={body} />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders text containing HTML markup as text — never as actual HTML', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: evil }] }],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    // The text appears verbatim, but no <img> element was created.
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('drops a link with a javascript: scheme but keeps the children as text', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'javascript:alert(1)',
                children: [{ type: 'text', text: 'click me' }],
              },
            ],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    // Children rendered as plain text…
    expect(screen.getByText('click me')).toBeInTheDocument();
    // …with no anchor element.
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders an https link with rel="noopener noreferrer"', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://grafana.com/docs',
                children: [{ type: 'text', text: 'docs' }],
              },
            ],
          },
        ],
      },
    };
    render(<PulseRenderer body={body} />);
    const a = screen.getByRole('link', { name: 'docs' });
    expect(a.getAttribute('href')).toBe('https://grafana.com/docs');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('renders an unknown node type as its plain children, not as HTML', () => {
    const body: PulseBody = {
      root: {
        type: 'root',
        children: [
          {
            type: 'iframe',
            children: [{ type: 'text', text: 'should never see an iframe' }],
          },
        ],
      },
    };
    const { container } = render(<PulseRenderer body={body} />);
    expect(screen.getByText('should never see an iframe')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });
});
