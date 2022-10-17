import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu } from 'react-select-event';

import { LogGroupSelector } from './LogGroupSelector';

jest.mock('lodash/debounce');

describe('LogGroupSelector', () => {
  it('shows previously saved log groups', () => {
    render(
      <LogGroupSelector
        selectedLogGroups={['previously/selected/log/group/names']}
        onChange={jest.fn()}
        describeLogGroups={jest.fn()}
      />
    );

    expect(screen.getByText('previously/selected/log/group/names')).toBeInTheDocument();
  });

  it('fetches new log groups on menu open', async () => {
    const describeLogGroups = jest.fn(() =>
      Promise.resolve([
        {
          label: 'fetched/log/group/name',
          value: 'fetched/log/group/name',
          text: 'fetched/log/group/name',
        },
      ])
    );
    render(
      <LogGroupSelector
        selectedLogGroups={['previously/selected/log/group/names']}
        onChange={jest.fn()}
        describeLogGroups={describeLogGroups}
      />
    );

    // on menu open describe log groups is called
    const logGroupSelector = await screen.findByLabelText('Log Groups');
    openMenu(logGroupSelector);
    await screen.findByText('fetched/log/group/name');

    expect(describeLogGroups).toBeCalledTimes(1);
  });

  it('shows previously selected log groups even if they are not returned by describeLogGroups', async () => {
    const describeLogGroups = jest.fn(() =>
      Promise.resolve([
        {
          label: 'fetched/log/group/name',
          value: 'fetched/log/group/name',
          text: 'fetched/log/group/name',
        },
      ])
    );
    render(
      <LogGroupSelector
        selectedLogGroups={['previously/selected/log/group/names']}
        onChange={jest.fn()}
        describeLogGroups={describeLogGroups}
      />
    );

    // on menu open describe log groups is called
    const logGroupSelector = await screen.findByLabelText('Log Groups');
    openMenu(logGroupSelector);
    await screen.findByText('fetched/log/group/name');

    expect(screen.getByText('previously/selected/log/group/names')).toBeInTheDocument();
    expect(screen.getByText('fetched/log/group/name')).toBeInTheDocument();
  });

  it('searches for new log groups with a prefix when users start typing', async () => {
    const describeLogGroups = jest.fn((prefix?: string) => {
      if (prefix) {
        return Promise.resolve([
          {
            label: 'just/log/group/names/that/start/with/prefix',
            value: 'just/log/group/names/that/start/with/prefix',
            text: 'just/log/group/names/that/start/with/prefix',
          },
        ]);
      }
      return Promise.resolve([
        {
          label: 'fetched/log/group/name',
          value: 'fetched/log/group/name',
          text: 'fetched/log/group/name',
        },
      ]);
    });
    render(
      <LogGroupSelector
        selectedLogGroups={['previously/selected/log/group/names']}
        onChange={jest.fn()}
        describeLogGroups={describeLogGroups}
      />
    );

    // on menu open describe log groups is called
    const logGroupSelector = await screen.findByLabelText('Log Groups');
    openMenu(logGroupSelector);
    await screen.findByText('fetched/log/group/name');
    await userEvent.type(logGroupSelector, 'j');
    await screen.findByText('just/log/group/names/that/start/with/prefix');

    expect(describeLogGroups).toHaveBeenCalledWith('j');
  });

  it('can handle errors', async () => {
    const describeLogGroups = jest.fn(() => {
      return Promise.reject('server exploded!');
    });
    render(
      <LogGroupSelector
        selectedLogGroups={['previously/selected/log/group/names']}
        onChange={jest.fn()}
        describeLogGroups={describeLogGroups}
      />
    );

    // on menu open describe log groups is called
    const logGroupSelector = await screen.findByLabelText('Log Groups');
    openMenu(logGroupSelector);
    await waitFor(() => expect(screen.getByText('No log groups available')).toBeInTheDocument());
  });
});
