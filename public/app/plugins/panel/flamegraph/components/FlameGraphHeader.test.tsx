import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { CoreApp } from '@grafana/data';

import FlameGraphHeader from './FlameGraphHeader';
import { SelectedView } from './types';

describe('FlameGraphHeader', () => {
  const FlameGraphHeaderWithProps = () => {
    const [search, setSearch] = useState('');
    const [selectedView, setSelectedView] = useState(SelectedView.Both);

    return (
      <FlameGraphHeader
        app={CoreApp.Explore}
        search={search}
        setSearch={setSearch}
        setTopLevelIndex={jest.fn()}
        setSelectedBarIndex={jest.fn()}
        setRangeMin={jest.fn()}
        setRangeMax={jest.fn()}
        selectedView={selectedView}
        setSelectedView={setSelectedView}
        containerWidth={1600}
      />
    );
  };

  it('reset button should remove search text', async () => {
    render(<FlameGraphHeaderWithProps />);
    await userEvent.type(screen.getByPlaceholderText('Search..'), 'abc');
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    screen.getByRole('button', { name: /Reset/i }).click();
    expect(screen.queryByDisplayValue('abc')).not.toBeInTheDocument();
  });
});
