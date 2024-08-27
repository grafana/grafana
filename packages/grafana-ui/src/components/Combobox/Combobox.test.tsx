import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, Option } from './Combobox';

// Mock data for the Combobox options
const options: Option[] = [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3', description: 'This is option 3' },
    { label: 'Option 4', value: '4' },
];

describe('Combobox', () => {
    const onChangeHandler = jest.fn((value) => {

    });
    beforeAll(() => {
        const mockGetBoundingClientRect = jest.fn(() => ({
            width: 120,
            height: 120,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
        }));

        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            value: mockGetBoundingClientRect,
        });
    });

    it('renders without error', () => {
        render(<Combobox options={options} value={null} onChange={onChangeHandler} />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should allow selecting a value by clicking directly', async () => {
        render(<Combobox options={options} onChange={onChangeHandler} value={null} />);

        const input = screen.getByRole('combobox');
        userEvent.click(input);

        const item = await screen.findByRole('option', { name: 'Option 1' });
        userEvent.click(item);
        expect(onChangeHandler).toHaveBeenCalled();
    });

    it('selects value by using keyboard only', async () => {
        render(<Combobox options={options} value={null} onChange={onChangeHandler} />);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
        expect(onChangeHandler).toHaveBeenCalled();
    });

    it('clears selected value', async () => {
        render(<Combobox options={options} value={options[1].value} onChange={onChangeHandler} />);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        const clearButton = screen.getByTitle('Clear value');
        await userEvent.click(clearButton);

        expect(onChangeHandler).toHaveBeenCalledWith(null);
        expect(screen.queryByDisplayValue('Option 1')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Option 2')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Option 3')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Option 4')).not.toBeInTheDocument();
    });
});
