import { render, screen } from '@testing-library/react';
import React from 'react';
import MetricsCell from './MetricsCell';
describe('MetricsCell', () => {
    it("doesn't render query if filter is empty", () => {
        render(React.createElement(MetricsCell, { filter: "" }));
        expect(screen.queryByLabelText('selector')).toBeNull();
    });
    it('renders if query is provided', () => {
        render(React.createElement(MetricsCell, { filter: '{action="add_client"}' }));
        expect(screen.queryByLabelText('selector')).not.toBeNull();
    });
});
//# sourceMappingURL=MetricsCell.test.js.map