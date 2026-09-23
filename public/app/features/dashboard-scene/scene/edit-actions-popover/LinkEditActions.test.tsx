import { fireEvent, render, screen } from 'test/test-utils';

import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { LinkEditActions } from './LinkEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));
const mockPublishAppEvent = jest.mocked(appEvents.publish);

function renderLinkEditActions() {
  const onClickEdit = jest.fn();
  const onClickDuplicate = jest.fn();
  const onClickDelete = jest.fn();

  const renderResult = render(
    <LinkEditActions
      name="Test link"
      onClickEdit={onClickEdit}
      onClickDuplicate={onClickDuplicate}
      onClickDelete={onClickDelete}
    />
  );

  return { ...renderResult, onClickEdit, onClickDuplicate, onClickDelete };
}

describe('<LinkEditActions />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders link Settings, Duplicate, and Delete controls', () => {
    renderLinkEditActions();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('when the user clicks on Settings', () => {
    test('calls onClickEdit', () => {
      const { onClickEdit } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(onClickEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user clicks on Duplicate', () => {
    test('calls onClickDuplicate', () => {
      const { onClickDuplicate } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(onClickDuplicate).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user clicks on Delete', () => {
    test('publishes a ShowConfirmModalEvent', () => {
      const { onClickDelete } = renderLinkEditActions();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockPublishAppEvent).toHaveBeenCalledTimes(1);

      const [arg] = mockPublishAppEvent.mock.calls[0];
      expect(arg).toBeInstanceOf(ShowConfirmModalEvent);
      expect(arg).toEqual(
        expect.objectContaining({
          payload: {
            title: 'Delete link',
            text: expect.stringContaining('Are you sure you want to delete: Test link?'),
            yesText: 'Delete link',
            onConfirm: onClickDelete,
          },
        })
      );
    });
  });
});
