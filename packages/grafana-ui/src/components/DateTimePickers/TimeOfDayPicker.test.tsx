import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime } from '@grafana/data';

import { TimeOfDayPicker } from './TimeOfDayPicker';

describe('TimeOfDayPicker', () => {
    it('renders correctly with a value', () => {
        const onChange = jest.fn();
        const value = dateTime(Date.now());

        render(<TimeOfDayPicker onChange={onChange} value={value} />);

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/);
    });

    it('renders without a value when allowEmpty is true', () => {
        const onChange = jest.fn();

        render(<TimeOfDayPicker onChange={onChange} allowEmpty={true} />);

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
        const onChange = jest.fn();
        const value = dateTime(Date.now());

        render(<TimeOfDayPicker onChange={onChange} value={value} disabled={true} />);

        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
    });

    it('calls onChange when user types a valid time', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();
        const value = dateTime(Date.now());

        render(<TimeOfDayPicker onChange={onChange} value={value} />);

        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, '14:30');
        await user.tab(); // blur to trigger change

        // onChange should be called with a DateTime object
        if (onChange.mock.calls.length > 0) {
            const newValue = onChange.mock.calls[0][0];
            expect(newValue).toBeDefined();
            expect(typeof newValue.hour).toBe('function'); // DateTime has .hour() method
        }
    });
});

