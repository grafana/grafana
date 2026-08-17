import { type ReactNode } from 'react';
import { act, createEvent, fireEvent, render, screen, userEvent } from 'test/test-utils';

import { QueryVariable } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../DashboardAnnotationsDataLayer';

import { AnnotationEditActions } from './AnnotationEditActions';
import { EditActionsPopover, WAIT_FOR_MOUSE_REST_DURATION_MS } from './EditActionsPopover';
import { LinkEditActions } from './LinkEditActions';
import { PanelEditActions } from './PanelEditActions';
import { VariableEditActions } from './VariableEditActions';

jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(),
    publish: jest.fn(),
  },
}));

async function hoverAndRest(element: HTMLElement) {
  jest.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.hover(element);
    act(() => {
      jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
    });
  } finally {
    jest.useRealTimers();
  }
}

describe('<EditActionsPopover />', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('when isEditable is false', () => {
    test('renders children and does not show floating content on hover', async () => {
      render(
        <EditActionsPopover isEditable={false} content={<span>popover-actions</span>}>
          <div data-testid="reference-child">variable control</div>
        </EditActionsPopover>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.getByTestId('reference-child')).toHaveTextContent('variable control');
      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });
  });

  describe('when isEditable is true', () => {
    describe('when the user hovers the reference', () => {
      test('if the pointer is not at rest, then floating content is not shown', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        await user.hover(screen.getByTestId('reference-child'));

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
      });

      test('if the pointer rests, then floating content is shown in the document', async () => {
        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

        await hoverAndRest(screen.getByTestId('reference-child'));

        expect(screen.getByText('popover-actions')).toBeInTheDocument();
      });

      test('if the user then unhovers, then floating content is hidden', async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        render(
          <EditActionsPopover isEditable={true} content={<span>popover-actions</span>}>
            <div data-testid="reference-child">variable control</div>
          </EditActionsPopover>
        );

        const referenceChild = screen.getByTestId('reference-child');
        await user.hover(referenceChild);
        act(() => {
          jest.advanceTimersByTime(WAIT_FOR_MOUSE_REST_DURATION_MS);
        });

        expect(screen.getByText('popover-actions')).toBeInTheDocument();

        await act(async () => {
          await user.unhover(referenceChild);
        });

        expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
      });
    });

    test('if content is null, then no floating panel is mounted when open', async () => {
      render(
        <EditActionsPopover isEditable={true} content={null}>
          <div data-testid="reference-child">variable control</div>
        </EditActionsPopover>
      );

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();

      await hoverAndRest(screen.getByTestId('reference-child'));

      expect(screen.queryByText('popover-actions')).not.toBeInTheDocument();
    });

    test('pointerdown stops event propagation', async () => {
      render(
        <EditActionsPopover isEditable={true} content={<button>action</button>}>
          <div data-testid="reference-child">control</div>
        </EditActionsPopover>
      );

      await hoverAndRest(screen.getByTestId('reference-child'));

      const actionButton = screen.getByRole('button', { name: 'action' });
      const pointerDownEvent = createEvent.pointerDown(actionButton);
      const stopPropagation = jest.spyOn(pointerDownEvent, 'stopPropagation');

      fireEvent(actionButton, pointerDownEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('when a popover action opens a modal', () => {
    async function renderAndOpenPopover(content: ReactNode) {
      render(
        <EditActionsPopover isEditable={true} content={content}>
          <div data-testid="reference-child">control</div>
        </EditActionsPopover>
      );
      await hoverAndRest(screen.getByTestId('reference-child'));
    }

    test('clicking Edit query closes the popover', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={new QueryVariable({ name: 'queryVar', query: 'label_values(job)' })}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });

    test('clicking the delete action closes the popover', async () => {
      await renderAndOpenPopover(
        <LinkEditActions
          name="Test link"
          onClickEdit={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    test('clicking the panel Edit visualization action closes the popover', async () => {
      await renderAndOpenPopover(
        <PanelEditActions
          onClickEdit={jest.fn()}
          onClickEditVisualization={jest.fn()}
          onClickCopy={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit visualization' }));

      expect(screen.queryByRole('button', { name: 'Edit visualization' })).not.toBeInTheDocument();
    });

    test('clicking the annotation Edit query action closes the popover', async () => {
      await renderAndOpenPopover(
        <AnnotationEditActions
          layer={
            new DashboardAnnotationsDataLayer({
              name: 'Test annotation',
              query: {
                name: 'Test annotation',
                enable: false,
                iconColor: '',
              },
            })
          }
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit query' }));

      expect(screen.queryByRole('button', { name: 'Edit query' })).not.toBeInTheDocument();
    });

    test('clicking Variable settings keeps the popover open', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={new QueryVariable({ name: 'queryVar', query: 'label_values(job)' })}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });

    test('clicking Duplicate keeps the popover open', async () => {
      await renderAndOpenPopover(
        <VariableEditActions
          variable={new QueryVariable({ name: 'queryVar', query: 'label_values(job)' })}
          onClickEdit={jest.fn()}
          onClickEditQuery={jest.fn()}
          onClickDuplicate={jest.fn()}
          onClickDelete={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

      expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    });
  });
});
