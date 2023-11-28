import { render, screen } from '@testing-library/react';
import React from 'react';
import { Label } from './Label';
describe('Label', () => {
    it('should render', () => {
        render(React.createElement(Label, { dataTestId: "test-label", label: "label" }));
        expect(screen.getByTestId('test-label')).toBeInTheDocument();
    });
});
//# sourceMappingURL=Label.test.js.map