import { render, screen } from '@testing-library/react';

import { ActionType, Field, FieldType, HttpRequestMethod } from '@grafana/data';

import { MaybeWrapWithLink } from './MaybeWrapWithLink';

describe('MaybeWrapWithLink', () => {
  describe('single link', () => {
    it('renders children as a link when there is a single link', () => {
      const link = { title: 'My link', url: 'http://example.com' };
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => [{ title: link.title, href: link.url, target: '_blank', origin: field }]),
        config: {
          links: [link],
          actions: [],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);
      const linkElement = screen.getByTitle(link.title);
      expect(linkElement).toBeInTheDocument();
      expect(linkElement).toHaveAttribute('href', link.url);
      expect(linkElement).toHaveTextContent('Test Link');
    });

    it('does not throw if getLinks unexpectedly returns nothing when a single link is present', () => {
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => []),
        config: {
          links: [{ title: 'My link', url: 'http://example.com' }],
          actions: [],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const childElement = screen.getByText('Test Link');
      expect(childElement).toBeInTheDocument();
    });
  });

  describe('multi link and/or actions', () => {
    it('renders a popup target link if multiple links are present', () => {
      const links = [
        { title: 'My link', url: 'http://example.com' },
        { title: 'Another link', url: 'http://example.com' },
      ];
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => links.map((l) => ({ title: l.title, href: l.url, target: '_blank', origin: field }))),
        config: {
          links,
          actions: [],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const linkElement = screen.getByTitle('view data links and actions');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement.tagName).toBe('A');
      expect(linkElement).toHaveAttribute('aria-haspopup', 'menu');
      expect(linkElement).toHaveTextContent('Test Link');
    });

    it('renders a popup target link if multiple actions are present', () => {
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => []),
        config: {
          links: [],
          actions: [
            {
              type: ActionType.Fetch,
              title: 'My action',
              [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com' },
            },
            {
              type: ActionType.Fetch,
              title: 'Another action',
              [ActionType.Fetch]: { method: HttpRequestMethod.POST, url: 'http://example.com' },
            },
          ],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const linkElement = screen.getByTitle('view data links and actions');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement.tagName).toBe('A');
      expect(linkElement).toHaveAttribute('aria-haspopup', 'menu');
      expect(linkElement).toHaveTextContent('Test Link');
    });

    it('renders a popup target link if a single action is present', () => {
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => []),
        config: {
          links: [],
          actions: [
            {
              type: ActionType.Fetch,
              title: 'My action',
              [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com' },
            },
          ],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const linkElement = screen.getByTitle('view data links and actions');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement.tagName).toBe('A');
      expect(linkElement).toHaveAttribute('aria-haspopup', 'menu');
      expect(linkElement).toHaveTextContent('Test Link');
    });

    it('renders a popup target link if a mixture of actions and links are present', () => {
      const links = [{ title: 'My link', url: 'http://example.com' }];
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => links.map((l) => ({ title: l.title, href: l.url, target: '_blank', origin: field }))),
        config: {
          links,
          actions: [
            {
              type: ActionType.Fetch,
              title: 'My action',
              [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com' },
            },
          ],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const linkElement = screen.getByTitle('view data links and actions');
      expect(linkElement).toBeInTheDocument();
      expect(linkElement.tagName).toBe('A');
      expect(linkElement).toHaveAttribute('aria-haspopup', 'menu');
      expect(linkElement).toHaveTextContent('Test Link');
    });
  });

  describe('no links or actions', () => {
    it('passes the children through when no links or actions are present', () => {
      const links = [
        { title: 'My link', url: 'http://example.com' },
        { title: 'Another link', url: 'http://example.com' },
      ];
      const field: Field = {
        type: FieldType.string,
        name: 'Test Field',
        values: [],
        getLinks: jest.fn(() => []),
        config: {
          links,
          actions: [],
        },
      };
      const rowIdx = 0;
      const children = <span>Test Link</span>;

      render(<MaybeWrapWithLink field={field} rowIdx={rowIdx} children={children} />);

      const childElement = screen.getByText('Test Link');
      expect(childElement).toBeInTheDocument();
    });
  });
});
