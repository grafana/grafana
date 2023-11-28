import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectors } from '@grafana/e2e-selectors';
import { RowOptionsForm } from './RowOptionsForm';
jest.mock('../RepeatRowSelect/RepeatRowSelect', () => ({
    RepeatRowSelect: () => React.createElement("div", null),
}));
describe('DashboardRow', () => {
    it('Should show warning component when has warningMessage prop', () => {
        render(React.createElement(TestProvider, null,
            React.createElement(RowOptionsForm, { repeat: '3', title: "", onCancel: jest.fn(), onUpdate: jest.fn(), warning: "a warning message" })));
        expect(screen.getByTestId(selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage)).toBeInTheDocument();
    });
    it('Should not show warning component when does not have warningMessage prop', () => {
        render(React.createElement(TestProvider, null,
            React.createElement(RowOptionsForm, { repeat: '3', title: "", onCancel: jest.fn(), onUpdate: jest.fn() })));
        expect(screen.queryByTestId(selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage)).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=RowOptionsForm.test.js.map