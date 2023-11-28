import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SectionContent } from './SectionContent';
const entitlement = {
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
    test('renders SectionContent with correct data', () => __awaiter(void 0, void 0, void 0, function* () {
        // TODO <Advisor> can't be within a <p> !!!
        jest.spyOn(console, 'error').mockImplementation();
        render(React.createElement(SectionContent, { entitlement: entitlement }));
        expect(screen.getByText(/Tier 1/)).toBeInTheDocument();
        expect(screen.getByText(/3 MySQL Servers/)).toBeInTheDocument();
        expect(screen.getByText(/Customer/)).toBeInTheDocument();
        expect(screen.getByText(/28\/10\/2019/)).toBeInTheDocument();
        expect(screen.getByText(/08\/02\/2022/)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=SectionContent.test.js.map