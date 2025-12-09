import { act, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import {
  AnnotationQuery,
  FieldType,
  LoadingState,
  PanelData,
  VariableSupportType,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setRunRequest } from '@grafana/runtime';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { AnnotationSettingsEdit } from './AnnotationSettingsEdit';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({
      ...defaultDatasource,
      variables: {
        getType: () => VariableSupportType.Custom,
        query: jest.fn(),
        editor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [
      toDataFrame({
        fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
      }),
    ],
    timeRange: getDefaultTimeRange(),
  })
);

setRunRequest(runRequestMock);

describe('AnnotationSettingsEdit', () => {
  const mockOnUpdate = jest.fn();
  const mockGoBackToList = jest.fn();
  const mockOnDelete = jest.fn();

  async function setup() {
    const annotationQuery: AnnotationQuery = {
      name: 'test',
      datasource: defaultDatasource,
      enable: true,
      hide: false,
      iconColor: 'blue',
    };

    const props = {
      annotation: annotationQuery,
      onUpdate: mockOnUpdate,
      editIndex: 1,
      panels: [],
      onBackToList: mockGoBackToList,
      onDelete: mockOnDelete,
    };

    return {
      anno: annotationQuery,
      renderer: await act(async () => render(<AnnotationSettingsEdit {...props} />)),
      user: userEvent.setup(),
    };
  }

  // For testing combobox
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();

    const nameInput = getByTestId(selectors.pages.Dashboard.Settings.Annotations.Settings.name);
    const dataSourceSelect = getByTestId(selectors.components.DataSourcePicker.container);
    const enableToggle = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.enable);
    const annotationControlsDisplaySelect = getByTestId(
      selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.annotationControlsDisplay
    );
    const iconColorToggle = getByTestId(selectors.components.ColorSwatch.name);
    const panelSelect = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.showInLabel);
    const deleteAnno = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.delete);
    const apply = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.apply);

    expect(nameInput).toBeInTheDocument();
    expect(dataSourceSelect).toBeInTheDocument();
    expect(enableToggle).toBeInTheDocument();
    expect(annotationControlsDisplaySelect).toBeInTheDocument();
    expect(iconColorToggle).toBeInTheDocument();
    expect(panelSelect).toBeInTheDocument();
    expect(deleteAnno).toBeInTheDocument();
    expect(apply).toBeInTheDocument();
  });

  it('should update annotation name on change', async () => {
    const {
      renderer: { getByTestId },
      user,
    } = await setup();

    await user.type(getByTestId(selectors.pages.Dashboard.Settings.Annotations.Settings.name), 'new name');

    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('should toggle annotation enabled on change', async () => {
    const {
      renderer: { getByTestId },
      user,
      anno,
    } = await setup();

    const annoArg = {
      ...anno,
      enable: !anno.enable,
    };

    const enableToggle = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.enable);

    await user.click(enableToggle);

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnUpdate).toHaveBeenCalledWith(annoArg, 1);
  });

  it('should set annotation filter', async () => {
    const {
      renderer: { getByTestId },
      user,
    } = await setup();

    const panelSelect = getByTestId(selectors.components.Annotations.annotationsTypeInput);

    await user.click(panelSelect);
    await user.tab();

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({ filter: undefined }), 1);
  });

  it('should delete annotation', async () => {
    const {
      renderer: { getByTestId },
      user,
    } = await setup();

    const deleteAnno = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.delete);

    await user.click(deleteAnno);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('should go back to list annotation', async () => {
    const {
      renderer: { getByTestId },
      user,
    } = await setup();

    const goBack = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.apply);

    await user.click(goBack);

    expect(mockGoBackToList).toHaveBeenCalledTimes(1);
  });

  it('should render the annotation controls display combobox', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();

    const field = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.annotationControlsDisplay);
    const combobox = within(field).getByRole('combobox');
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveValue('Above dashboard');
  });

  it('should set placement to undefined when selecting "Above dashboard" instead of  "Controls menu"', async () => {
    const annotationQuery: AnnotationQuery = {
      name: 'test',
      datasource: defaultDatasource,
      enable: true,
      hide: false,
      iconColor: 'blue',
      placement: 'inControlsMenu',
    };

    const props = {
      annotation: annotationQuery,
      onUpdate: mockOnUpdate,
      editIndex: 1,
      panels: [],
      onBackToList: mockGoBackToList,
      onDelete: mockOnDelete,
    };

    const {
      user,
      renderer: { getByTestId, findByText },
    } = {
      user: userEvent.setup(),
      renderer: await act(async () => render(<AnnotationSettingsEdit {...props} />)),
    };

    const field = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.annotationControlsDisplay);
    const combobox = within(field).getByRole('combobox');
    await user.click(combobox);

    const aboveDashboardOption = await findByText('Above dashboard');
    await user.click(aboveDashboardOption);

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnUpdate).toHaveBeenCalledWith(
      {
        ...annotationQuery,
        placement: undefined,
      },
      1
    );
  });

  it('should set `hide: true` and `placement: undefined` when selecting "Hidden"', async () => {
    const annotationQuery: AnnotationQuery = {
      name: 'test',
      datasource: defaultDatasource,
      enable: true,
      hide: false,
      iconColor: 'blue',
      placement: 'inControlsMenu',
    };

    const props = {
      annotation: annotationQuery,
      onUpdate: mockOnUpdate,
      editIndex: 1,
      panels: [],
      onBackToList: mockGoBackToList,
      onDelete: mockOnDelete,
    };

    const {
      user,
      renderer: { getByTestId, findByText },
    } = {
      user: userEvent.setup(),
      renderer: await act(async () => render(<AnnotationSettingsEdit {...props} />)),
    };

    const field = getByTestId(selectors.pages.Dashboard.Settings.Annotations.NewAnnotation.annotationControlsDisplay);
    const combobox = within(field).getByRole('combobox');
    await user.click(combobox);

    const hiddenOption = await findByText('Hidden');
    await user.click(hiddenOption);

    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnUpdate).toHaveBeenCalledWith(
      {
        ...annotationQuery,
        hide: true,
        placement: undefined,
      },
      1
    );
  });
});
