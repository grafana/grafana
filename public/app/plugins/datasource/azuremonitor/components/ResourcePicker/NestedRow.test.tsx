import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NestedRow from './NestedRow';
import { type ResourceRow, ResourceRowType } from './types';

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
  disableRow: jest.fn().mockReturnValue(false),
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

  it('should disable a checkbox if specified', () => {
    render(
      <table>
        <tbody>
          <NestedRow {...defaultProps} selectableEntryTypes={[ResourceRowType.Resource]} disableRow={() => true} />
        </tbody>
      </table>
    );
    const box = screen.queryByRole('checkbox');
    expect(box).toBeDisabled();
  });

  it('should check a checkbox if the uri matches regardless of the case', () => {
    render(
      <table>
        <tbody>
          <NestedRow
            {...defaultProps}
            selectableEntryTypes={[ResourceRowType.Resource]}
            selectedRows={[{ ...defaultProps.row, uri: defaultProps.row.uri.toUpperCase() }]}
          />
        </tbody>
      </table>
    );
    const box = screen.queryByRole('checkbox');
    expect(box).toBeChecked();
  });

  it('should display the resource group if available', () => {
    render(
      <table>
        <tbody>
          <NestedRow
            {...defaultProps}
            row={{
              id: '1',
              uri: '/subscriptions/1/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/test-vm',
              name: '1',
              type: ResourceRowType.Resource,
              typeLabel: '1',
            }}
            selectableEntryTypes={[ResourceRowType.Resource]}
            selectedRows={[{ ...defaultProps.row, uri: defaultProps.row.uri.toUpperCase() }]}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('test-rg')).toBeInTheDocument();
  });

  it('should not display the resource group if row is a subscription', () => {
    render(
      <table>
        <tbody>
          <NestedRow
            {...defaultProps}
            row={{
              id: '1',
              uri: '/subscriptions/1',
              name: '1',
              type: ResourceRowType.Subscription,
              typeLabel: '1',
            }}
            selectableEntryTypes={[ResourceRowType.Resource]}
            selectedRows={[{ ...defaultProps.row, uri: defaultProps.row.uri.toUpperCase() }]}
          />
        </tbody>
      </table>
    );

    const rg = screen.queryByText('test-rg');
    expect(rg).not.toBeInTheDocument();
  });

  it('should not display the resource group if row is a resource group', () => {
    render(
      <table>
        <tbody>
          <NestedRow
            {...defaultProps}
            row={{
              id: '1',
              uri: '/subscriptions/1/resourceGrops/test-rg',
              name: '1',
              type: ResourceRowType.ResourceGroup,
              typeLabel: '1',
            }}
            selectableEntryTypes={[ResourceRowType.Resource]}
            selectedRows={[{ ...defaultProps.row, uri: defaultProps.row.uri.toUpperCase() }]}
          />
        </tbody>
      </table>
    );

    const rg = screen.queryByText('test-rg');
    expect(rg).not.toBeInTheDocument();
  });

  it('auto-opens for a saved selection but preserves a manual collapse across re-renders', async () => {
    const user = userEvent.setup();
    const child: ResourceRow = {
      id: 'child',
      uri: '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm-1',
      name: 'vm-1',
      type: ResourceRowType.Resource,
      typeLabel: 'vm',
    };
    const parent: ResourceRow = {
      id: 'parent',
      uri: '/subscriptions/sub/resourceGroups/rg',
      name: 'rg-1',
      type: ResourceRowType.ResourceGroup,
      typeLabel: 'rg',
      children: [child],
    };
    const props = {
      ...defaultProps,
      row: parent,
      selectedRows: [child],
      selectableEntryTypes: [ResourceRowType.Resource],
    };

    const { rerender } = render(
      <table>
        <tbody>
          <NestedRow {...props} />
        </tbody>
      </table>
    );

    // The row auto-opens because it contains the selected resource.
    expect(screen.getByText('vm-1')).toBeInTheDocument();

    // The user manually collapses the row.
    await user.click(screen.getByLabelText('Collapse rg-1'));
    expect(screen.queryByText('vm-1')).not.toBeInTheDocument();

    // A tree re-render gives this row a new object identity (same content) — e.g. when a
    // sibling row is expanded. The manual collapse must be preserved: the auto-open effect
    // should not re-fire and force the row back open.
    rerender(
      <table>
        <tbody>
          <NestedRow {...props} row={{ ...parent, children: [child] }} />
        </tbody>
      </table>
    );
    expect(screen.queryByText('vm-1')).not.toBeInTheDocument();
  });
});
