import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { LatestInformation } from 'app/percona/shared/core/reducers/updates';

import { AvailableUpdate } from './AvailableUpdate';

const version = 'x.y.z';
const tag = 'percona/pmm-server:x.y.z-rc.j+1234567890';
const newsLink = 'https://percona.com';
const timestamp = '2024-06-23T00:00:00.000Z';

const nextVersion: LatestInformation = {
  version,
  tag,
  timestamp,
};

describe('AvailableUpdate::', () => {
  it('should show only the short version by default', () => {
    render(<AvailableUpdate nextVersion={nextVersion} newsLink={newsLink} />);

    expect(screen.getByTestId('update-latest-version')).toHaveTextContent(version);
  });

  it('should show the news link if present', () => {
    render(<AvailableUpdate nextVersion={nextVersion} newsLink={newsLink} />);

    expect(screen.getByTestId('update-news-link')).toBeTruthy();
  });

  it('should show the full version on alt-click', () => {
    render(<AvailableUpdate nextVersion={nextVersion} newsLink={newsLink} />);

    fireEvent.click(screen.getByTestId('update-latest-section'), { altKey: true });

    expect(screen.getByTestId('update-latest-version')).toHaveTextContent(tag);
  });
});
