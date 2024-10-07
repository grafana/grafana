import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { CurrentInformation } from 'app/percona/shared/core/reducers/updates';

import { CurrentVersion } from './CurrentVersion';

const fullVersion = 'x.y.z-rc.j+1234567890';
const version = 'x.y.z';
const timestamp = '2024-06-23T00:00:00.000Z';
const date = 'June 23, 2024 UTC';

const currentInformation: CurrentInformation = {
  fullVersion,
  version,
  timestamp,
};

describe('CurrentVersion::', () => {
  it('should show only the short version by default', async () => {
    const container = render(<CurrentVersion currentVersion={currentInformation} />);

    expect(container.baseElement).toHaveTextContent(`Current version: ${version} (${date})`);
  });

  it('should show the full version on alt-click', () => {
    const container = render(<CurrentVersion currentVersion={currentInformation} />);
    fireEvent.click(screen.getByTestId('update-installed-version'), { altKey: true });

    expect(container.baseElement).toHaveTextContent(`Current version: ${fullVersion} (${date})`);
  });
});
