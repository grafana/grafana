import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiFilter } from './MultiFilter';

describe('MultiFilters', () => {
  describe('when rendered with two existing multifilters', () => {
    it('should render two filter items', async () => {
      const filters = {
        InstanceId: ['a', 'b'],
        InstanceGroup: ['Group1'],
      };
      const onChange = jest.fn();
      render(<MultiFilter filters={filters} onChange={onChange} />);
      const filterItems = screen.getAllByTestId('cloudwatch-multifilter-item');
      expect(filterItems.length).toBe(2);

      expect(within(filterItems[0]).getByDisplayValue('InstanceId')).toBeInTheDocument();
      expect(within(filterItems[0]).getByText('a')).toBeInTheDocument();
      expect(within(filterItems[0]).getByText('b')).toBeInTheDocument();

      expect(within(filterItems[1]).getByDisplayValue('InstanceGroup')).toBeInTheDocument();
      expect(within(filterItems[1]).getByText('Group1')).toBeInTheDocument();
    });
  });

  describe('when adding a new filter item', () => {
    it('it should add the new item but not call onChange', async () => {
      const filters = {};
      const onChange = jest.fn();
      render(<MultiFilter filters={filters} onChange={onChange} />);

      userEvent.click(screen.getByLabelText('Add'));
      expect(screen.getByTestId('cloudwatch-multifilter-item')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('when adding a new filter item with key', () => {
    it('it should add the new item but not call onChange', async () => {
      const filters = {};
      const onChange = jest.fn();
      const { container } = render(<MultiFilter filters={filters} onChange={onChange} />);

      userEvent.click(screen.getByLabelText('Add'));
      const filterItemElement = screen.getByTestId('cloudwatch-multifilter-item');
      expect(filterItemElement).toBeInTheDocument();

      const keyElement = container.querySelector('#cloudwatch-multifilter-item-key');
      expect(keyElement).toBeInTheDocument();
      userEvent.type(keyElement!, 'my-key');
      fireEvent.keyDown(keyElement!, { keyCode: 13 });

      expect(within(filterItemElement).getByDisplayValue('my-key')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('when adding a new filter item with key and value', () => {
    it('it should add the new item and trigger onChange', async () => {
      const filters = {};
      const onChange = jest.fn();
      const { container } = render(<MultiFilter filters={filters} onChange={onChange} />);

      const label = await screen.findByLabelText('Add');
      userEvent.click(label);
      const filterItemElement = screen.getByTestId('cloudwatch-multifilter-item');
      expect(filterItemElement).toBeInTheDocument();

      const keyElement = container.querySelector('#cloudwatch-multifilter-item-key');
      expect(keyElement).toBeInTheDocument();
      userEvent.type(keyElement!, 'my-key');
      fireEvent.keyDown(keyElement!, { keyCode: 13 });
      expect(within(filterItemElement).getByDisplayValue('my-key')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();

      const valueElement = container.querySelector('#cloudwatch-multifilter-item-value');
      expect(valueElement).toBeInTheDocument();
      userEvent.type(valueElement!, 'my-value');
      fireEvent.keyDown(valueElement!, { keyCode: 13 });
      expect(within(filterItemElement).getByText('my-value')).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith({
        'my-key': ['my-value'],
      });
    });
  });
});
