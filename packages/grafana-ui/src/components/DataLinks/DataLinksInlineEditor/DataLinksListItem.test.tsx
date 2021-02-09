import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataLinksListItem, DataLinksListItemProps } from './DataLinksListItem';

function setupTestContext(options: Partial<DataLinksListItemProps>) {
  const defaults: DataLinksListItemProps = {
    index: 0,
    link: { url: '', title: '', onBuildUrl: jest.fn(), onClick: jest.fn() },
    data: [],
    onChange: jest.fn(),
    onEdit: jest.fn(),
    onRemove: jest.fn(),
    suggestions: [],
  };

  const props = { ...defaults, ...options };
  const { rerender } = render(<DataLinksListItem {...props} />);

  return { rerender, props };
}

describe('DataLinksListItem', () => {
  describe('when link has title', () => {
    it('then the link title should be visible', () => {
      const link = {
        url: 'http://localhost:3000',
        title: 'Some Data Link Title',
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/some data link title/i)).toBeInTheDocument();
    });
  });

  describe('when link has url', () => {
    it('then the link url should be visible', () => {
      const link = {
        url: 'http://localhost:3000',
        title: 'Some Data Link Title',
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
      expect(screen.getByTitle(/http:\/\/localhost\:3000/i)).toBeInTheDocument();
    });
  });

  describe('when link is missing title', () => {
    it('then the link title should be replaced by [Data link title not provided]', () => {
      const link = {
        url: 'http://localhost:3000',
        title: (undefined as unknown) as string,
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link title not provided/i)).toBeInTheDocument();
    });
  });

  describe('when link is missing url', () => {
    it('then the link url should be replaced by [Data link url not provided]', () => {
      const link = {
        url: (undefined as unknown) as string,
        title: (undefined as unknown) as string,
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link url not provided/i)).toBeInTheDocument();
      expect(screen.getByTitle('')).toBeInTheDocument();
    });
  });

  describe('when link title is empty', () => {
    it('then the link title should be replaced by [Data link title not provided]', () => {
      const link = {
        url: 'http://localhost:3000',
        title: '             ',
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link title not provided/i)).toBeInTheDocument();
    });
  });

  describe('when link url is empty', () => {
    it('then the link url should be replaced by [Data link url not provided]', () => {
      const link = {
        url: '             ',
        title: '             ',
        onBuildUrl: jest.fn(),
        onClick: jest.fn(),
      };
      setupTestContext({ link });

      expect(screen.getByText(/data link url not provided/i)).toBeInTheDocument();
      expect(screen.getByTitle('')).toBeInTheDocument();
    });
  });
});
