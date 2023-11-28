import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createDefaultConfigOptions } from '../mocks';
import { ConfigEditor } from './ConfigEditor';
describe('ConfigEditor', () => {
    it('should render without error', () => {
        expect(() => render(React.createElement(ConfigEditor, { onOptionsChange: () => { }, options: createDefaultConfigOptions() }))).not.toThrow();
    });
    it('should render the right sections', () => {
        render(React.createElement(ConfigEditor, { onOptionsChange: () => { }, options: createDefaultConfigOptions() }));
        expect(screen.getByRole('heading', { name: 'Connection' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Authentication' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Advanced HTTP settings' })).toBeInTheDocument();
        expect(screen.getByText('Maximum lines')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Derived fields' })).toBeInTheDocument();
    });
    it('should pass correct data to onChange', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChangeMock = jest.fn();
        render(React.createElement(ConfigEditor, { onOptionsChange: onChangeMock, options: createDefaultConfigOptions() }));
        const maxLinesInput = yield screen.findByDisplayValue('531');
        yield userEvent.type(maxLinesInput, '2');
        expect(onChangeMock).toHaveBeenCalledWith(expect.objectContaining({
            jsonData: expect.objectContaining({
                maxLines: '5312',
            }),
        }));
    }));
});
//# sourceMappingURL=ConfigEditor.test.js.map