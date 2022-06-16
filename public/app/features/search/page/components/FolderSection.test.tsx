import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { getGrafanaSearcher } from '../../service';

import { FolderSection } from './FolderSection';

// jest.mock('../../service', () => ({
//   getGrafanaSearcher: jest.fn(),
// }))

describe('FolderSection', () => {
  beforeEach(() => {
    jest.spyOn(getGrafanaSearcher(), 'search').mockImplementation(() => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve([]);
        }, 10000);
      });
    });
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

  it('clicking the section header retrieves the folder contents and shows a spinner', async () => {
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);

    await userEvent.click(await screen.findByRole('button', { name: mockSection.title }));
    expect(getGrafanaSearcher().search).toHaveBeenCalled();
    expect(await screen.findByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders a loading spinner whilst the data is being retrieved', async () => {
    render(<FolderSection section={mockSection} onTagSelected={mockOnTagSelected} />);
    console.log(screen.debug());
    const spinner = await screen.findByTestId('loading-spinner');
    console.log(screen.debug());
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(spinner).toBeInTheDocument();
    console.log(screen.debug());
  });
});
