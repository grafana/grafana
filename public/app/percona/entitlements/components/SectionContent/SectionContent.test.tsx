import React from 'react';
import { render, screen } from '@testing-library/react';
import { SectionContent } from './SectionContent';
import { Entitlement } from '../../Entitlements.types';

const entitlement: Entitlement = {
  number: 'ENTLMT0001028',
  name: 'Unmeasured MySQL Support - Premium - ENTLMT0001026',
  summary: '3 MySQL Servers',
  totalUnits: '3',
  tier: 'Tier 1',
  unlimitedUnits: false,
  supportLevel: 'Customer',
  softwareFamilies: ['MySQL', 'Oracle'],
  startDate: '28/10/2019',
  endDate: '08/02/2022',
  platform: {
    securityAdvisor: true,
    configAdvisor: false,
  },
};

describe('Entitlements Content', () => {
  test('renders SectionContent with correct data', async () => {
    render(<SectionContent entitlement={entitlement} />);

    expect(screen.getByText(/Tier 1/)).toBeInTheDocument();
    expect(screen.getByText(/3 MySQL Servers/)).toBeInTheDocument();
    expect(screen.getByText(/Customer/)).toBeInTheDocument();
    expect(screen.getByText(/MySQL, Oracle/)).toBeInTheDocument();
    expect(screen.getByText(/28\/10\/2019/)).toBeInTheDocument();
    expect(screen.getByText(/08\/02\/2022/)).toBeInTheDocument();
  });
});
