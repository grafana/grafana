import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Chip } from './Chip';
describe('Chip::', () => {
    it('should render chips', () => {
        render(React.createElement("div", null,
            React.createElement(Chip, { text: "chip1" }),
            React.createElement(Chip, { text: "chip2" })));
        expect(screen.getAllByTestId('chip')).toHaveLength(2);
    });
    it('should not render the cross icon if isRemovable is not passed', () => {
        render(React.createElement("div", null,
            React.createElement(Chip, { text: "chip1" }),
            React.createElement(Chip, { text: "chip2" })));
        expect(screen.queryAllByTestId('chip-remove')).toHaveLength(0);
    });
    it('should remove chip from screen', () => {
        render(React.createElement("div", null,
            React.createElement(Chip, { isRemovable: true, text: "chip1" }),
            React.createElement(Chip, { isRemovable: true, text: "chip2" })));
        const secondChipCrossIcon = screen.getAllByTestId('chip')[1].getElementsByTagName('svg')[0];
        fireEvent.click(secondChipCrossIcon);
        expect(screen.getAllByTestId('chip')).toHaveLength(1);
    });
    it('should call onRemove', () => {
        const spy = jest.fn();
        render(React.createElement("div", null,
            React.createElement(Chip, { isRemovable: true, text: "chip1", onRemove: spy })));
        fireEvent.click(screen.getByTestId('chip').getElementsByTagName('svg')[0]);
        expect(spy).toHaveBeenCalled();
    });
});
//# sourceMappingURL=Chip.test.js.map