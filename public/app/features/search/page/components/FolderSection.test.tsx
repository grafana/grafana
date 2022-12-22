import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';

import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { FolderSection } from './FolderSection';

describe('FolderSection', () => {
  let grafanaSearcherSpy: jest.SpyInstance;
  const mockOnTagSelected = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSelection = jest.fn();
  const mockSection = {
    kind: 'folder',
    uid: 'my-folder',
    title: 'My folder',
  };

  // need to make sure we clear localStorage
  // otherwise tests can interfere with each other and the starting expanded state of the component
  afterEach(() => {
    window.localStorage.clear();
  });

  describe('when there are no results', () => {
    const emptySearchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector([]) },
        { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([]) },
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector([]) },
      ],
      length: 0,
    };

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: emptySearchData.length,
      view: new DataFrameView<DashboardQueryResult>(emptySearchData),
    };

    beforeAll(() => {
      grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });

    it('shows the folder title as the header', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
    });

    describe('when renderStandaloneBody is set', () => {
      it('shows a "No results found" message and does not show the folder title header', async () => {
        render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
        expect(await screen.findByText('No results found')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
      });

      it('renders a loading spinner whilst waiting for the results', async () => {
        // mock the query promise so we can resolve manually
        let promiseResolver: (arg0: QueryResponse) => void;
        const promise = new Promise((resolve) => {
          promiseResolver = resolve;
        });
        grafanaSearcherSpy.mockImplementationOnce(() => promise);

        render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
        expect(await screen.findByTestId('Spinner')).toBeInTheDocument();

        // resolve the promise
        await act(async () => {
          promiseResolver(mockSearchResult);
        });

        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
        expect(await screen.findByText('No results found')).toBeInTheDocument();
      });
    });

    it('shows a "No results found" message when expanding the folder', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

      await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
      expect(getGrafanaSearcher().search).toHaveBeenCalled();
      expect(await screen.findByText('No results found')).toBeInTheDocument();
    });
  });

  describe('when there are results', () => {
    const searchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([DashboardSearchItemType.DashDB]) },
        { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(['My dashboard 1']) },
        { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(['my-dashboard-1']) },
        { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
        { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([['foo', 'bar']]) },
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(['my-folder-1']) },
      ],
      meta: {
        custom: {
          locationInfo: {
            'my-folder-1': {
              name: 'My folder 1',
              kind: 'folder',
              url: '/my-folder-1',
            },
          },
        },
      },
      length: 1,
    };

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(searchData),
    };

    beforeAll(() => {
      grafanaSearcherSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
    });

    it('shows the folder title as the header', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
    });

    describe('when renderStandaloneBody is set', () => {
      it('shows the folder children and does not render the folder title', async () => {
        render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
        expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
      });

      it('renders a loading spinner whilst waiting for the results', async () => {
        // mock the query promise so we can resolve manually
        let promiseResolver: (arg0: QueryResponse) => void;
        const promise = new Promise((resolve) => {
          promiseResolver = resolve;
        });
        grafanaSearcherSpy.mockImplementationOnce(() => promise);

        render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
        expect(await screen.findByTestId('Spinner')).toBeInTheDocument();

        // resolve the promise
        await act(async () => {
          promiseResolver(mockSearchResult);
        });

        expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
        expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
      });
    });

    it('shows the folder contents when expanding the folder', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

      await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
      expect(getGrafanaSearcher().search).toHaveBeenCalled();
      expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
    });

    describe('when clicking the checkbox', () => {
      it('does not expand the section', async () => {
        render(
          <FolderSection
            section={mockSection}
            selection={mockSelection}
            selectionToggle={mockSelectionToggle}
            onTagSelected={mockOnTagSelected}
          />
        );

        await userEvent.click(await screen.findByRole('checkbox', { name: 'Select folder' }));
        expect(screen.queryByText('My dashboard 1')).not.toBeInTheDocument();
      });

      it('selects only the folder if the folder is not expanded', async () => {
        render(
          <FolderSection
            section={mockSection}
            selection={mockSelection}
            selectionToggle={mockSelectionToggle}
            onTagSelected={mockOnTagSelected}
          />
        );

        await userEvent.click(await screen.findByRole('checkbox', { name: 'Select folder' }));
        expect(mockSelectionToggle).toHaveBeenCalledWith('folder', 'my-folder');
        expect(mockSelectionToggle).not.toHaveBeenCalledWith('dashboard', 'my-dashboard-1');
      });

      it('selects the folder and all children when the folder is expanded', async () => {
        render(
          <FolderSection
            section={mockSection}
            selection={mockSelection}
            selectionToggle={mockSelectionToggle}
            onTagSelected={mockOnTagSelected}
          />
        );

        await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
        expect(getGrafanaSearcher().search).toHaveBeenCalled();

        await userEvent.click(await screen.findByRole('checkbox', { name: 'Select folder' }));
        expect(mockSelectionToggle).toHaveBeenCalledWith('folder', 'my-folder');
        expect(mockSelectionToggle).toHaveBeenCalledWith('dashboard', 'my-dashboard-1');
      });
    });

    describe('when in a pseudo-folder (i.e. Starred/Recent)', () => {
      const mockRecentSection = {
        kind: 'folder',
        uid: '__recent',
        title: 'Recent',
        itemsUIDs: ['my-dashboard-1'],
      };

      it('shows the correct folder name next to the dashboard', async () => {
        render(<FolderSection section={mockRecentSection} onTagSelected={mockOnTagSelected} />);

        await userEvent.click(await screen.findByRole('button', { name: mockRecentSection.title }));
        expect(getGrafanaSearcher().search).toHaveBeenCalled();
        expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
        expect(await screen.findByText('My folder 1')).toBeInTheDocument();
      });
    });
  });
});
