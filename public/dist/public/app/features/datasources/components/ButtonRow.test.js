import { screen, render } from '@testing-library/react';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { ButtonRow } from './ButtonRow';
const setup = (propOverrides) => {
    const props = {
        canSave: false,
        canDelete: true,
        onDelete: jest.fn(),
        onSubmit: jest.fn(),
        onTest: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(ButtonRow, Object.assign({}, props)));
};
describe('<ButtonRow>', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByTestId(selectors.pages.DataSource.delete)).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });
    it('should render save & test', () => {
        setup({ canSave: true });
        expect(screen.getByTestId(selectors.pages.DataSource.saveAndTest)).toBeInTheDocument();
    });
});
//# sourceMappingURL=ButtonRow.test.js.map