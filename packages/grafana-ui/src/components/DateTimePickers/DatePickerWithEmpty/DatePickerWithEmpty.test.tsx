import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePickerWithEmpty } from './DatePickerWithEmpty';

describe('DatePickerWithEmpty', () => {
  it('renders date input', () => {
    render(
      <DatePickerWithEmpty
        isDateInput={false}
        isOpen={true}
        onChange={jest.fn()}
        onClose={jest.fn()}
        value={new Date(1400000000000)}
      />
    );

    expect(screen.getAllByText('May 2014')[0]).toBeInTheDocument();
  });
  it('renders date input without a value', () => {
    render(<DatePickerWithEmpty isDateInput={false} isOpen={true} onChange={jest.fn()} onClose={jest.fn()} />);
    expect(
      screen.getAllByText(`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`)[0]
    ).toBeInTheDocument();
  });
  it('should not render, isOpen = false', () => {
    render(<DatePickerWithEmpty isDateInput={false} isOpen={false} onChange={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument();
  });
  describe('input is clicked', () => {
    it('should click on a date and change it according to that', () => {
      const onChange = jest.fn();

      render(
        <DatePickerWithEmpty
          isDateInput={true}
          isOpen={true}
          onChange={onChange}
          onClose={jest.fn()}
          value={new Date(1383346799999)}
        />
      );
      const ninethOfTheMonth = screen.getByText('31');
      const button = ninethOfTheMonth.parentElement;
      button?.click();
      expect(screen.getAllByText('October 2013')[0]).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    it('onChange has been called', () => {
      const onChange = jest.fn();

      render(
        <DatePickerWithEmpty
          isDateInput={true}
          isOpen={true}
          onChange={onChange}
          onClose={jest.fn()}
          value={new Date(1383346799999)}
        />
      );
      const ninethOfTheMonth = screen.getByText('31');
      const button = ninethOfTheMonth.parentElement;
      button?.click();
      expect(screen.getAllByText('October 2013')[0]).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    it('closes calendar after outside wrapper is clicked', () => {
      const onClose = jest.fn();

      render(
        <DatePickerWithEmpty
          isDateInput={true}
          isOpen={true}
          onChange={jest.fn()}
          onClose={onClose}
          value={new Date(1383346799999)}
        />
      );

      expect(screen.getByTestId('date-picker')).toBeInTheDocument();

      fireEvent.click(document);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
