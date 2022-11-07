import { render, screen } from '@testing-library/react';
import React from 'react';

import NestedRow from './NestedRow';
import { ResourceRowType } from './types';

const defaultProps = {
  row: {
    id: '1',
    uri: 'some-uri',
    name: '1',
    type: ResourceRowType.Resource,
    typeLabel: '1',
  },
  level: 0,
  selectedRows: [],
  requestNestedRows: jest.fn(),
  onRowSelectedChange: jest.fn(),
  selectableEntryTypes: [],
  scrollIntoView: false,
};

describe('NestedRow', () => {
  it('should not display a checkbox when the type of row is empty', () => {
    render(
      <table>
        <tbody>
          <NestedRow {...defaultProps} />
        </tbody>
      </table>
    );
    const box = screen.queryByRole('checkbox');
    expect(box).not.toBeInTheDocument();
  });

  it('should display a checkbox when the type of row is in selectableEntryTypes', () => {
    render(
      <table>
        <tbody>
          <NestedRow {...defaultProps} selectableEntryTypes={[ResourceRowType.Resource]} />
        </tbody>
      </table>
    );
    const box = screen.queryByRole('checkbox');
    expect(box).toBeInTheDocument();
  });

  it('should not display a checkbox when the type of row is not in selectableEntryTypes', () => {
    render(
      <table>
        <tbody>
          <NestedRow {...defaultProps} selectableEntryTypes={[ResourceRowType.ResourceGroup]} />
        </tbody>
      </table>
    );
    const box = screen.queryByRole('checkbox');
    expect(box).not.toBeInTheDocument();
  });
});
