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
        selectedView={selectedView}
        setSelectedView={setSelectedView}
        containerWidth={1600}
        onReset={() => {
          setSearch('');
        }}
        onTextAlignChange={jest.fn()}
        textAlign={'left'}
      />
    );
  };

  it('reset button should remove search text', async () => {
    render(<FlameGraphHeaderWithProps />);
    await userEvent.type(screen.getByPlaceholderText('Search..'), 'abc');
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(screen.queryByDisplayValue('abc')).not.toBeInTheDocument();
  });
});
