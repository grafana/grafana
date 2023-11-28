import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createDefaultConfigOptions } from '../mocks';
import { AlertingSettings } from './AlertingSettings';
const options = createDefaultConfigOptions();
describe('AlertingSettings', () => {
    it('should render', () => {
        render(React.createElement(AlertingSettings, { options: options, onOptionsChange: () => { } }));
        expect(screen.getByText('Alerting')).toBeInTheDocument();
    });
    it('should update alerting settings', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AlertingSettings, { options: options, onOptionsChange: onChange }));
        yield userEvent.click(screen.getByLabelText('Toggle switch'));
        expect(onChange).toHaveBeenCalledTimes(1);
    }));
});
//# sourceMappingURL=AlertingSettings.test.js.map