import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataFrameView } from '@grafana/data';

import { getGrafanaSearcher, QueryResponse, SearchQuery } from '../../service';

import { FolderSection } from './FolderSection';

// jest.mock('../../service', () => ({
//   getGrafanaSearcher: jest.fn(),
// }))

describe('FolderSection', () => {
  let searchSpy: jest.SpyInstance<Promise<QueryResponse>, [query: SearchQuery]>;

  beforeEach(() => {
    searchSpy = jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue({
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: 0,
      view: new DataFrameView({
        fields: [],
        length: 0,
      }),
    }); // .mockImplementation(() => {
    //   return new Promise((resolve, reject) => {
    //     setTimeout(() => {
    //       resolve([]);
    //     }, 10000);
    //   });
    // });
  });

  const mockOnTagSelected = jest.fn();
  const mockSelectionToggle = jest.fn();
  const mockSection = {
    kind: 'folder',
    uid: 'alsdkjaslkdjalk',
    title: 'My folder',
  };

  it('renders the section header', async () => {
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
    expect(await screen.findByText(mockSection.title)).toBeInTheDocument();
  });

  // TODO add children to wait for
  it.skip('does not render the section header when renderStandaloneBody is set', async () => {
    render(<FolderSection renderStandaloneBody section={mockSection} onTagSelected={mockOnTagSelected} />);
    console.log(screen.debug());
    expect(screen.queryByText(mockSection.title)).not.toBeInTheDocument();
  });

  it('clicking the section header retrieves the folder contents and shows a spinner', async () => {
    // Promise that never resolves
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

    await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
    expect(getGrafanaSearcher().search).toHaveBeenCalled();
  });

  it('shows a message if there are no results', async () => {
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

    await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
    expect(getGrafanaSearcher().search).toHaveBeenCalled();
    expect(await screen.findByText('No results found')).toBeInTheDocument();
  });
});
