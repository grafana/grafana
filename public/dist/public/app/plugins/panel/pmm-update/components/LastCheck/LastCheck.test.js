import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { LastCheck } from './LastCheck';
describe('LastCheck::', () => {
    const lastCheckDate = '12345';
    const fakeHandleClick = jest.fn();
    it('should show the passed last check date', () => {
        const container = render(React.createElement(LastCheck, { onCheckForUpdates: fakeHandleClick, lastCheckDate: lastCheckDate }));
        expect(container.baseElement.textContent).toEqual(`Last check: ${lastCheckDate}`);
    });
    it('should call the passed onClick handler on Button click', () => {
        render(React.createElement(LastCheck, { onCheckForUpdates: fakeHandleClick, lastCheckDate: lastCheckDate }));
        fireEvent.click(screen.getByTestId('update-last-check-button'));
        expect(fakeHandleClick).toBeCalledTimes(1);
    });
});
//# sourceMappingURL=LastCheck.test.js.map