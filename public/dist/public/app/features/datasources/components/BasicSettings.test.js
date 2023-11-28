import { render, screen } from '@testing-library/react';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { BasicSettings } from './BasicSettings';
const setup = () => {
    const props = {
        dataSourceName: 'Graphite',
        isDefault: false,
        onDefaultChange: jest.fn(),
        onNameChange: jest.fn(),
        alertingSupported: false,
    };
    return render(React.createElement(BasicSettings, Object.assign({}, props)));
};
describe('<BasicSettings>', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByRole('textbox', { name: selectors.pages.DataSource.name })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Default/ })).toBeInTheDocument();
    });
});
//# sourceMappingURL=BasicSettings.test.js.map