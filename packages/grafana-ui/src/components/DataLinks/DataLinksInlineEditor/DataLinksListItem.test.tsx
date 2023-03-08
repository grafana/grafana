import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataLinksListItem, DataLinksListItemProps } from './DataLinksListItem';

const baseLink = {
  url: '',
  title: '',
  onBuildUrl: jest.fn(),
  onClick: jest.fn(),
};

function setupTestContext(options: Partial<DataLinksListItemProps>) {
  const defaults: DataLinksListItemProps = {
    index: 0,
    link: baseLink,
    data: [],
    onChange: jest.fn(),
    onEdit: jest.fn(),
    onRemove: jest.fn(),
  };

  const props = { ...defaults, ...options };
  const { rerender } = render(<DataLinksListItem {...props} />);

  return { rerender, props };
}

describe('DataLinksListItem', () => {
  describe('when link has title', () => {
    it('then the link title should be visible', () => {
      const link = {
        ...baseLink,
        title: 'Some Data Link Title',
      };
      setupTestContext({ link });

      expect(screen.getByText(/some data link title/i)).toBeInTheDocument();
    });
  });

  describe('when link has url', () => {
    it('then the link url should be visible', () => {
      const link = {
        ...baseLink,
        url: 'http://localhost:3000',
      };
      setupTestContext({ link });

      expect(screen.getByText(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
      expect(screen.getByTitle(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
    });

    it('that is a explore compact url, then the title should be a warning', () => {
      const link = {
        ...baseLink,
        url: 'http://localhost:3000/explore?orgId=1&left=[%22now-1h%22,%22now%22,%22gdev-loki%22,{%22expr%22:%22{place=%22luna%22}%22,%22refId%22:%22A%22}]',
      };
      setupTestContext({ link });

      expect(screen.getByText(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
      expect(screen.getByText(/Explore data link may not work in the future. Please edit./i)).toBeInTheDocument();
    });
  });

  describe('when link is missing title', () => {
    it('then the link title should be replaced by [Data link title not provided]', () => {
      const link = {
        ...baseLink,
        title: undefined as unknown as string,
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link title not provided/i)).toBeInTheDocument();
    });
  });

  describe('when link is missing url', () => {
    it('then the link url should be replaced by [Data link url not provided]', () => {
      const link = {
        ...baseLink,
        url: undefined as unknown as string,
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link url not provided/i)).toBeInTheDocument();
      expect(screen.getByTitle('')).toBeInTheDocument();
    });
  });

  describe('when link title is empty', () => {
    it('then the link title should be replaced by [Data link title not provided]', () => {
      const link = {
        ...baseLink,
        title: '             ',
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link title not provided/i)).toBeInTheDocument();
    });
  });

  describe('when link url is empty', () => {
    it('then the link url should be replaced by [Data link url not provided]', () => {
      const link = {
        ...baseLink,
        url: '             ',
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link url not provided/i)).toBeInTheDocument();
      expect(screen.getByTitle('')).toBeInTheDocument();
    });
  });
});
