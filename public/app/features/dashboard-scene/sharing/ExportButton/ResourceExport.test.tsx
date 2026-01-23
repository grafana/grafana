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

      const radioGroup = screen.getByRole('radiogroup', { name: /model/i });
      const labels = within(radioGroup)
        .getAllByRole('radio')
        .map((radio) => radio.parentElement?.textContent?.trim());

      expect(labels).toHaveLength(3);
      expect(labels).toEqual(['Classic', 'V1 Resource', 'V2 Resource']);
    });

    it('should have first option selected by default when exportMode is Classic', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic })} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup', { name: /model/i });
      const radios = within(radioGroup).getAllByRole('radio');
      expect(radios[0]).toBeChecked();
    });

    it('should call onExportModeChange when export mode is changed', async () => {
      const onExportModeChange = jest.fn();
      render(<ResourceExport {...createDefaultProps({ onExportModeChange })} />);
      await expandOptions();

      const radioGroup = screen.getByRole('radiogroup', { name: /model/i });
      const radios = within(radioGroup).getAllByRole('radio');
      await userEvent.click(radios[1]); // V1 Resource
      expect(onExportModeChange).toHaveBeenCalledWith(ExportMode.V1Resource);
    });
  });

  describe('export mode options for v2 dashboard', () => {
    it('should not show export mode options', async () => {
      render(<ResourceExport {...createDefaultProps({ dashboardJson: createV2DashboardJson() })} />);
      await expandOptions();

      expect(screen.queryByRole('radiogroup', { name: /model/i })).not.toBeInTheDocument();
    });
  });

  describe('format options', () => {
    it('should not show format options when export mode is Classic', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.Classic })} />);
      await expandOptions();

      expect(screen.getByRole('radiogroup', { name: /model/i })).toBeInTheDocument();
      expect(screen.queryByRole('radiogroup', { name: /format/i })).not.toBeInTheDocument();
    });

    it.each([ExportMode.V1Resource, ExportMode.V2Resource])(
      'should show format options when export mode is %s',
      async (exportMode) => {
        render(<ResourceExport {...createDefaultProps({ exportMode })} />);
        await expandOptions();

        expect(screen.getByRole('radiogroup', { name: /model/i })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: /format/i })).toBeInTheDocument();
      }
    );

    it('should have first format option selected when isViewingYAML is false', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, isViewingYAML: false })} />);
      await expandOptions();

      const formatGroup = screen.getByRole('radiogroup', { name: /format/i });
      const formatRadios = within(formatGroup).getAllByRole('radio');
      expect(formatRadios[0]).toBeChecked(); // JSON
    });

    it('should have second format option selected when isViewingYAML is true', async () => {
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, isViewingYAML: true })} />);
      await expandOptions();

      const formatGroup = screen.getByRole('radiogroup', { name: /format/i });
      const formatRadios = within(formatGroup).getAllByRole('radio');
      expect(formatRadios[1]).toBeChecked(); // YAML
    });

    it('should call onViewYAML when format is changed', async () => {
      const onViewYAML = jest.fn();
      render(<ResourceExport {...createDefaultProps({ exportMode: ExportMode.V1Resource, onViewYAML })} />);
      await expandOptions();

      const formatGroup = screen.getByRole('radiogroup', { name: /format/i });
      const formatRadios = within(formatGroup).getAllByRole('radio');
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
});
