import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AnnotationQuery } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { MoveDirection } from '../AnnotationsEditView';

import { AnnotationSettingsList, BUTTON_TITLE } from './AnnotationSettingsList';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('AnnotationSettingsEdit', () => {
  const mockOnNew = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnMove = jest.fn();
  const mockOnDelete = jest.fn();

  async function setup(emptyList = false) {
    const annotationQuery1: AnnotationQuery = {
      name: 'test1',
      datasource: defaultDatasource,
      enable: true,
      hide: false,
      iconColor: 'blue',
    };

    const annotationQuery2: AnnotationQuery = {
      name: 'test2',
      datasource: defaultDatasource,
      enable: true,
      hide: false,
      iconColor: 'red',
    };

    const props = {
      annotations: emptyList ? [] : [annotationQuery1, annotationQuery2],
      onNew: mockOnNew,
      onEdit: mockOnEdit,
      onMove: mockOnMove,
      onDelete: mockOnDelete,
    };

    return {
      renderer: await act(async () => render(<AnnotationSettingsList {...props} />)),
      user: userEvent.setup(),
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render with empty list message', async () => {
    const {
      renderer: { getByRole },
    } = await setup(true);

    const emptyListBtn = getByRole('button', { name: BUTTON_TITLE });

    expect(emptyListBtn).toBeInTheDocument();
  });

  it('should create new annotation when empty list button is pressed', async () => {
    const {
      renderer: { getByRole },
      user,
    } = await setup(true);

    const emptyListBtn = getByRole('button', { name: BUTTON_TITLE });

    await user.click(emptyListBtn);

    expect(mockOnNew).toHaveBeenCalledTimes(1);
  });

  it('should render annotation list', async () => {
    const {
      renderer: { getByTestId },
    } = await setup();

    const list = getByTestId(selectors.pages.Dashboard.Settings.Annotations.List.annotations);

    expect(list.children.length).toBe(2);
  });

  it('should edit annotation', async () => {
    const {
      renderer: { getAllByRole },
      user,
    } = await setup();

    const gridCells = getAllByRole('gridcell');

    await user.click(gridCells[0]);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should move annotation up', async () => {
    const {
      renderer: { getAllByLabelText },
      user,
    } = await setup();

    const moveBtns = getAllByLabelText('Move up');

    await user.click(moveBtns[0]);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
    expect(mockOnMove).toHaveBeenCalledWith(expect.anything(), MoveDirection.UP);
  });

  it('should move annotation down', async () => {
    const {
      renderer: { getAllByLabelText },
      user,
    } = await setup();

    const moveBtns = getAllByLabelText('Move down');

    await user.click(moveBtns[0]);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
    expect(mockOnMove).toHaveBeenCalledWith(expect.anything(), MoveDirection.DOWN);
  });
});
