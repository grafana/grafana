import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import Discovery from './Discovery';
jest.mock('app/percona/add-instance/components/Discovery/Discovery.service');
describe('Discovery:: ', () => {
    it('should render credentials, instances and docs', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => render(React.createElement(Discovery, { onSubmit: jest.fn(), selectInstance: jest.fn() })));
        expect(screen.getByTestId('credentials-form')).toBeInTheDocument();
        expect(screen.getByTestId('instances-table-wrapper')).toBeInTheDocument();
        expect(screen.getByTestId('discovery-docs')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=Discovery.test.js.map