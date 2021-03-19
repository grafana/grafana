import React, { ComponentProps } from 'react';
import { FieldType } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import { InspectDataTab } from './InspectDataTab';

const createProps = (propsOverride?: Partial<ComponentProps<typeof InspectDataTab>>) => {
  const defaultProps = {
    isLoading: false,
    options: {
      withTransforms: false,
      withFieldConfig: false,
    },
    data: [
      {
        name: 'First data frame',
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['uniqueA', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
        length: 3,
      },
      {
        name: 'Second data frame',
        fields: [
          { name: 'time', type: FieldType.time, values: [400, 500, 600] },
          { name: 'name', type: FieldType.string, values: ['d', 'e', 'g'] },
          { name: 'value', type: FieldType.number, values: [4, 5, 6] },
        ],
        length: 3,
      },
    ],
  };

  return Object.assign(defaultProps, propsOverride) as ComponentProps<typeof InspectDataTab>;
};

describe('InspectDataTab', () => {
  describe('when panel is not passed as prop (Explore)', () => {
    it('should render InspectDataTab', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.getByLabelText(/Panel inspector Data content/i)).toBeInTheDocument();
    });
    it('should render Data Option row', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.getByText(/Data options/i)).toBeInTheDocument();
    });
    it('should show available options', () => {
      render(<InspectDataTab {...createProps()} />);
      const dataOptions = screen.getByText(/Data options/i);
      fireEvent.click(dataOptions);
      expect(screen.getByText(/Show data frame/i)).toBeInTheDocument();
      expect(screen.getByText(/Download for Excel/i)).toBeInTheDocument();
    });
    it('should show available dataFrame options', () => {
      render(<InspectDataTab {...createProps()} />);
      const dataOptions = screen.getByText(/Data options/i);
      fireEvent.click(dataOptions);
      const dataFrameInput = screen.getByLabelText(/Select dataframe/i);
      fireEvent.change(dataFrameInput, {
        target: { value: 1 },
      });
      expect(screen.getByText(/Second data frame/i)).toBeInTheDocument();
    });
  });
});
