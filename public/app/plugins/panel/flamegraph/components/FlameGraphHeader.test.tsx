import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { CoreApp } from '@grafana/data';

import FlameGraphHeader from './FlameGraphHeader';
import { SelectedView } from './types';

describe('FlameGraphHeader', () => {
  const FlameGraphHeaderWithProps = ({ app }: { app: CoreApp }) => {
    const [search, setSearch] = useState('');

    return (
      <FlameGraphHeader
        app={app}
        search={search}
        setSearch={setSearch}
        setTopLevelIndex={jest.fn()}
        setRangeMin={jest.fn()}
        setRangeMax={jest.fn()}
        selectedView={SelectedView.Both}
        setSelectedView={jest.fn()}
        containerWidth={1600}
      />
    );
  };

  it('reset button should remove search text', async () => {
    render(<FlameGraphHeaderWithProps app={CoreApp.Unknown} />);
    expect(screen.getByPlaceholderText('Search..')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Search..'), 'abc');
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    screen.getByRole('button', { name: /Reset/i }).click();
    expect(screen.queryByDisplayValue('abc')).not.toBeInTheDocument();
  });
});
