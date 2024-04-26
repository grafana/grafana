import { render, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';

import LokiCheatSheet from './LokiCheatSheet';

const setup = () => {
  const props: ComponentProps<typeof LokiCheatSheet> = {
    datasource: {
      languageProvider: {
        started: true,
        getLabelKeys: jest.fn().mockReturnValue(['job']),
        fetchLabelValues: jest.fn().mockResolvedValue(['"grafana/data"']),
      },
    } as unknown as LokiDatasource,
    query: {} as unknown as LokiQuery,
    onClickExample: jest.fn(),
  };
  return props;
};

describe('Loki Cheat Sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('escapes label values in examples', async () => {
    const props = setup();
    render(<LokiCheatSheet {...props} />);
    jest.runAllTimers();

    const streamSelector = await screen.findByText('{job="\\"grafana/data\\""}');
    expect(streamSelector).toBeInTheDocument();
  });
});
