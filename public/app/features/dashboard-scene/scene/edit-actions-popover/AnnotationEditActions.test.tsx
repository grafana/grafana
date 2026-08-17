import { fireEvent, render, screen } from 'test/test-utils';

import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DashboardAnnotationsDataLayer } from '../DashboardAnnotationsDataLayer';

import { AnnotationEditActions } from './AnnotationEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

const buildDataLayer = () =>
  new DashboardAnnotationsDataLayer({
    name: 'Test annotation',
    query: {
      name: 'Test annotation',
      enable: false,
      iconColor: '',
    },
  });

function renderAnnotationEditActions(dataLayer = buildDataLayer()) {
  const onClickEdit = jest.fn();
  const onClickEditQuery = jest.fn();
  const onClickDuplicate = jest.fn();
  const onClickDelete = jest.fn();

  const renderResult = render(
    <AnnotationEditActions
      layer={dataLayer}
      onClickEdit={onClickEdit}
      onClickEditQuery={onClickEditQuery}
      onClickDuplicate={onClickDuplicate}
      onClickDelete={onClickDelete}
    />
  );

  return { ...renderResult, onClickEdit, onClickEditQuery, onClickDuplicate, onClickDelete };
}

describe('<AnnotationEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders annotation settings, edit query, duplicate, and delete controls', () => {
    renderAnnotationEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit query' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Annotation settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit, onClickDelete } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Edit query', () => {
    test('calls onClickEditQuery', () => {
      const { onClickEdit, onClickEditQuery } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(onClickEditQuery).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickEdit, onClickDuplicate, onClickDelete } = renderAnnotationEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
      expect(onClickEdit).not.toHaveBeenCalled();
      expect(onClickDelete).not.toHaveBeenCalled();
    });
  });

  describe('when the user clicks on the delete action', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const dataLayer = buildDataLayer();
      const { onClickDelete } = renderAnnotationEditActions(dataLayer);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete annotation query',
            text: expect.stringContaining(`Are you sure you want to delete: ${dataLayer.state.name}?`),
            yesText: 'Delete annotation query',
            onConfirm: onClickDelete,
          },
        })
      );
    });
  });
});
