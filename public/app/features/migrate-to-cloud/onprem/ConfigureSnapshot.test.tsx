import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ResourceDependencyDto } from '../api';

import { ConfigureSnapshot } from './ConfigureSnapshot';
import { ResourceTypeId } from './resourceDependency';

// Mock the functions imported by the component
jest.mock('./resourceDependency', () => {
  const originalModule = jest.requireActual('./resourceDependency');
  return {
    ...originalModule,
    buildDependencyMaps: jest.fn(originalModule.buildDependencyMaps),
    handleSelection: jest.fn(originalModule.handleSelection),
    handleDeselection: jest.fn(originalModule.handleDeselection),
  };
});

jest.mock('./resourceInfo', () => {
  return {
    iconNameForResource: jest.fn(() => 'dashboard'),
    pluralizeResourceName: jest.fn((type) => {
      switch (type) {
        case 'DASHBOARD':
          return 'Dashboards';
        case 'FOLDER':
          return 'Folders';
        case 'DATASOURCE':
          return 'Data Sources';
        default:
          return type;
      }
    }),
  };
});

describe(ConfigureSnapshot.name, () => {
  const mockResourceDependencies: ResourceDependencyDto[] = [
    {
      resourceType: 'DASHBOARD',
      dependencies: ['FOLDER', 'DATASOURCE'],
    },
    {
      resourceType: 'FOLDER',
      dependencies: [],
    },
    {
      resourceType: 'DATASOURCE',
      dependencies: [],
    },
  ];

  const setup = (propOverrides?: Partial<React.ComponentProps<typeof ConfigureSnapshot>>) => {
    const props = {
      disabled: false,
      isLoading: false,
      onClick: jest.fn() as jest.Mock<void, [ResourceTypeId[]]>,
      resourceDependencies: mockResourceDependencies,
      ...propOverrides,
    };

    return {
      ...render(<ConfigureSnapshot {...props} />),
      props,
    };
  };

  it('should render all checkboxes and build snapshot button', () => {
    setup();

    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-include-all')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-dashboard')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-folder')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-datasource')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button')).toBeInTheDocument();
  });

  it('should handle unchecking then checking Include all', async () => {
    setup();

    const includeAllCheckbox = screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-include-all');
    await userEvent.click(includeAllCheckbox);

    // Include all checkbox should be unchecked
    expect(includeAllCheckbox).not.toBeChecked();

    // All resource type checkboxes should be unchecked
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-dashboard')).not.toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-folder')).not.toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-datasource')).not.toBeChecked();

    // Then check all again
    await userEvent.click(includeAllCheckbox);

    // Include all checkbox should be checked
    expect(includeAllCheckbox).toBeChecked();

    // All resource type checkboxes should be checked
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-dashboard')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-folder')).toBeChecked();
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-datasource')).toBeChecked();
  });

  it('should handle unchecking individual resource type', async () => {
    setup();
    const handleDeselection = require('./resourceDependency').handleDeselection;

    // Mock return value for handleDeselection - it would deselect DASHBOARD and its dependencies
    handleDeselection.mockImplementationOnce(() => new Set(['FOLDER', 'DATASOURCE']));

    const dashboardCheckbox = screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-dashboard');
    await userEvent.click(dashboardCheckbox);

    expect(handleDeselection).toHaveBeenCalled();

    // Include all checkbox should now be in indeterminate state (not checked by property).
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-include-all')).not.toBeChecked();
  });

  it('should handle checking individual resource type', async () => {
    setup();

    // First uncheck all
    const includeAllCheckbox = screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-include-all');
    await userEvent.click(includeAllCheckbox);

    const handleSelection = require('./resourceDependency').handleSelection;

    // Mock return value for handleSelection - it would select DASHBOARD and its dependencies
    handleSelection.mockImplementationOnce(() => new Set(['DASHBOARD', 'FOLDER', 'DATASOURCE']));

    const dashboardCheckbox = screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-dashboard');
    await userEvent.click(dashboardCheckbox);

    expect(handleSelection).toHaveBeenCalled();

    expect(includeAllCheckbox).toBeChecked();
  });

  it('should call onClick with selected resource types when Build snapshot is clicked', async () => {
    const { props } = setup();

    const buildSnapshotButton = screen.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button');
    await userEvent.click(buildSnapshotButton);

    expect(props.onClick).toHaveBeenCalledWith(expect.arrayContaining(['DASHBOARD', 'FOLDER', 'DATASOURCE']));
  });

  it('should disable Build snapshot button when no types are selected', async () => {
    setup();

    const includeAllCheckbox = screen.getByTestId('migrate-to-cloud-configure-snapshot-checkbox-resource-include-all');
    await userEvent.click(includeAllCheckbox);

    const buildSnapshotButton = screen.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button');
    expect(buildSnapshotButton).toBeDisabled();
  });

  it('should disable Build snapshot button when disabled prop is true', () => {
    setup({ disabled: true });

    const buildSnapshotButton = screen.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button');
    expect(buildSnapshotButton).toBeDisabled();
  });

  it('should show spinner in button when isLoading is true', () => {
    setup({ isLoading: true });

    // Buttons with a spinner icon
    expect(screen.getByTestId('migrate-to-cloud-configure-snapshot-build-snapshot-button').innerHTML).toContain(
      'spinner'
    );
  });
});
