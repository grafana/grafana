import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ArrayVector, DataFrame, DataFrameView, FieldType } from '@grafana/data';

import { DashboardQueryResult, getGrafanaSearcher } from '../../service';
import { DashboardSearchItemType } from '../../types';

import { FolderSection } from './FolderSection';

describe('FolderSection', () => {
  const grafanaSearcher = getGrafanaSearcher();
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

  describe('when where are no results', () => {
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

    beforeAll(() => {
      jest.spyOn(grafanaSearcher, 'search').mockResolvedValue({
        isItemLoaded: jest.fn(),
        loadMoreItems: jest.fn(),
        totalRows: emptySearchData.length,
        view: new DataFrameView<DashboardQueryResult>(emptySearchData),
      });
    });

    it('shows the folder title as the header', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
    });

    it('shows a "No results found" message and does not show the folder title header when renderStandaloneBody is set', async () => {
      render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByText('No results found')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
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
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(['/my-dashboard-1']) },
      ],
      length: 1,
    };

    beforeAll(() => {
      jest.spyOn(grafanaSearcher, 'search').mockResolvedValue({
        isItemLoaded: jest.fn(),
        loadMoreItems: jest.fn(),
        totalRows: searchData.length,
        view: new DataFrameView<DashboardQueryResult>(searchData),
      });
    });

    it('shows the folder title as the header', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByRole('button', { name: mockSection.title })).toBeInTheDocument();
    });

    it('shows the folder children and does not render the folder title when renderStandaloneBody is set', async () => {
      render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
      expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: mockSection.title })).not.toBeInTheDocument();
    });

    it('shows the folder contents when expanding the folder', async () => {
      render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

      await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
      expect(getGrafanaSearcher().search).toHaveBeenCalled();
      expect(await screen.findByText('My dashboard 1')).toBeInTheDocument();
    });

    it('selects the folder and all children when the checkbox is clicked', async () => {
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
});
