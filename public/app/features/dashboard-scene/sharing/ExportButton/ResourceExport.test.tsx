import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AsyncState } from 'react-use/lib/useAsync';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ExportMode, ResourceExport } from './ResourceExport';

type DashboardJsonState = AsyncState<{
  json: Dashboard | DashboardV2Spec | { error: unknown };
  hasLibraryPanels?: boolean;
  initialSaveModelVersion: 'v1' | 'v2';
}>;

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

const createDefaultProps = (overrides?: Partial<Parameters<typeof ResourceExport>[0]>) => {
  const defaultProps: Parameters<typeof ResourceExport>[0] = {
    dashboardJson: {
      loading: false,
      value: {
        json: { title: 'Test Dashboard' } as Dashboard,
        hasLibraryPanels: false,
        initialSaveModelVersion: 'v1',
      },
    } as DashboardJsonState,
    isSharingExternally: false,
    exportMode: ExportMode.Classic,
    isViewingYAML: false,
    onExportModeChange: jest.fn(),
    onShareExternallyChange: jest.fn(),
    onViewYAML: jest.fn(),
  };

  return { ...defaultProps, ...overrides };
};

const createV2DashboardJson = (hasLibraryPanels = false): DashboardJsonState => ({
  loading: false,
  value: {
    json: {
      title: 'Test V2 Dashboard',
      spec: {
        elements: {},
      },
    } as unknown as DashboardV2Spec,
    hasLibraryPanels,
    initialSaveModelVersion: 'v2',
  },
});

const expandOptions = async () => {
  const button = screen.getByRole('button', { expanded: false });
  await userEvent.click(button);
};

describe('ResourceExport', () => {
  describe('export mode options for v1 dashboard', () => {
    it('should show three export mode options in correct order: Classic, V1 Resource, V2 Resource', async () => {
      render(<ResourceExport {...createDefaultProps()} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup');
      const labels = within(radioGroup)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent?.trim());

      expect(labels).toHaveLength(3);
      expect(labels).toEqual(['Classic', 'V1 Resource', 'V2 Resource']);
    });

    it('should have first option selected by default when exportMode is Classic', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic })} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup');
      const radios = within(radioGroup).getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });

    it('should call onExportModeChange when export mode is changed', async () => {
      const onExportModeChange = jest.fn();
      render(<ResourceExport {...createDefaultProps({ onExportModeChange })} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup');
      const radios = within(radioGroup).getAllByRole('radio');
      await userEvent.click(radios[1]); // V1 Resource
      expect(onExportModeChange).toHaveBeenCalledWith(ExportMode.V1Resource);
    });
  });

  describe('export mode options for v2 dashboard', () => {
    it('should show two export mode options in correct order: V2 Resource, V1 Resource', async () => {
      render(<ResourceExport {...createDefaultProps({ dashboardJson: createV2DashboardJson() })} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup');
      const labels = within(radioGroup)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent?.trim());

      expect(labels).toHaveLength(2);
      expect(labels).toEqual(['V2 Resource', 'V1 Resource']);
    });
  });

  describe('format options', () => {
    it('should not show format options when export mode is Classic', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic })} />);
      await expandOptions();

      const radioGroups = screen.getAllByRole('radiogroup');
      expect(radioGroups).toHaveLength(1); // Only the export mode radio group
    });

    it.each([ExportMode.V1Resource, ExportMode.V2Resource])(
      'should show format options when export mode is %s',
      async (exportMode) => {
        render(<ResourceExport {...createDefaultProps({ exportMode })} />);
        await expandOptions();

        const radioGroups = screen.getAllByRole('radiogroup');
        expect(radioGroups).toHaveLength(2); // Export mode + format
      }
    );

    it('should have first format option selected when isViewingYAML is false', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, isViewingYAML: false })} />);
      await expandOptions();

      const radioGroups = screen.getAllByRole('radiogroup');
      const formatRadios = within(radioGroups[1]).getAllByRole('radio');
      expect(formatRadios[0]).toBeChecked(); // JSON
    });

    it('should have second format option selected when isViewingYAML is true', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, isViewingYAML: true })} />);
      await expandOptions();

      const radioGroups = screen.getAllByRole('radiogroup');
      const formatRadios = within(radioGroups[1]).getAllByRole('radio');
      expect(formatRadios[1]).toBeChecked(); // YAML
    });

    it('should call onViewYAML when format is changed', async () => {
      const onViewYAML = jest.fn();
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, onViewYAML })} />);
      await expandOptions();

      const radioGroups = screen.getAllByRole('radiogroup');
      const formatRadios = within(radioGroups[1]).getAllByRole('radio');
      await userEvent.click(formatRadios[1]); // YAML
      expect(onViewYAML).toHaveBeenCalled();
    });
  });

  describe('share externally switch', () => {
    it('should show share externally switch for Classic mode', () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic })} />);

      expect(screen.getByTestId(selector.exportExternallyToggle)).toBeInTheDocument();
    });

    it('should show share externally switch for V2Resource mode with V2 dashboard', () => {
      render(
        <ResourceExport
          {...createDefaultProps({
            dashboardJson: createV2DashboardJson(),
            exportMode: ExportMode.V2Resource,
          })}
        />
      );

      expect(screen.getByTestId(selector.exportExternallyToggle)).toBeInTheDocument();
    });

    it('should call onShareExternallyChange when switch is toggled', async () => {
      const onShareExternallyChange = jest.fn();
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic, onShareExternallyChange })} />);

      const switchElement = screen.getByTestId(selector.exportExternallyToggle);
      await userEvent.click(switchElement);
      expect(onShareExternallyChange).toHaveBeenCalled();
    });

    it('should reflect isSharingExternally value in switch', () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic, isSharingExternally: true })} />);

      expect(screen.getByTestId(selector.exportExternallyToggle)).toBeChecked();
    });
  });

  describe('library panels warning alert', () => {
    it('should not show alert when dashboard has no library panels', () => {
      render(
        <ResourceExport
          {...createDefaultProps({
            dashboardJson: createV2DashboardJson(false),
            isSharingExternally: true,
          })}
        />
      );

      expect(screen.queryByTestId(selector.libraryPanelsAlert)).not.toBeInTheDocument();
    });

    it('should not show alert when not sharing externally', () => {
      render(
        <ResourceExport
          {...createDefaultProps({
            dashboardJson: createV2DashboardJson(true),
            isSharingExternally: false,
          })}
        />
      );

      expect(screen.queryByTestId(selector.libraryPanelsAlert)).not.toBeInTheDocument();
    });

    it('should show alert when V2 dashboard has library panels and sharing externally', () => {
      render(
        <ResourceExport
          {...createDefaultProps({
            dashboardJson: createV2DashboardJson(true),
            isSharingExternally: true,
          })}
        />
      );

      expect(screen.getByTestId(selector.libraryPanelsAlert)).toBeInTheDocument();
    });

    it('should not show alert for V1 dashboard with library panels', () => {
      const v1DashboardWithLibPanels: DashboardJsonState = {
        loading: false,
        value: {
          json: { title: 'Test V1 Dashboard' } as Dashboard,
          hasLibraryPanels: true,
          initialSaveModelVersion: 'v1',
        },
      };

      render(
        <ResourceExport
          {...createDefaultProps({
            dashboardJson: v1DashboardWithLibPanels,
            isSharingExternally: true,
          })}
        />
      );

      expect(screen.queryByTestId(selector.libraryPanelsAlert)).not.toBeInTheDocument();
    });
  });
});
