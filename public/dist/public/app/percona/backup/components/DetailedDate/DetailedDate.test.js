import { render, screen } from '@testing-library/react';
import React from 'react';
import { DetailedDate } from './DetailedDate';
describe('DetailedDate', () => {
    it('should render', () => {
        render(React.createElement(DetailedDate, { date: Date.now() }));
        expect(screen.getByTestId('detailed-date')).toBeInTheDocument();
        expect(screen.getByTestId('detailed-date').children).toHaveLength(2);
    });
});
//# sourceMappingURL=DetailedDate.test.js.map