import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import uPlot from 'uplot';

import { ScopedVars } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { PanelContext, UPlotConfigBuilder, usePanelContext } from '@grafana/ui';
import { TimeRange2 } from '@grafana/ui/internal';

import { AnnotationsPlugin2 } from './AnnotationsPlugin2';
import {
  allAnnotationRegions,
  allAnnotations,
  mockAlertingFrame,
  mockAnnotationFrame,
  mockIRMAnnotation,
  mockIRMAnnotationRegion,
} from './mocks/mockAnnotationFrames';

const minTime = 1759388895560;
const maxTime = 1759390250000 + 1;
const plotWidth = 600;

jest.mock('uplot', () => {
  const setDataMock = jest.fn();
  const setSizeMock = jest.fn();
  const initializeMock = jest.fn();
  const destroyMock = jest.fn();
  const valToPos = jest.fn().mockImplementation((time: number, scale = 'x') => {
    // time delta
    const dt = maxTime - minTime;
    // adjusted time
    const t = time - minTime;
    // normalized time
    const nt = t / dt;
    // convert to pixels
    return Math.min(nt * plotWidth);
  });
  const redraw = jest.fn();
  return jest.fn().mockImplementation(() => {
    return {
      setData: setDataMock,
      setSize: setSizeMock,
      initialize: initializeMock,
      destroy: destroyMock,
      valToPos,
      redraw,
      rect: {
        width: plotWidth,
      },
      root: {
        querySelector: jest.fn().mockImplementation(() => document.getElementById('grafana-portal-container')),
      },
    };
  });
});

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  usePanelContext: jest.fn().mockImplementation(() => ({
    canExecuteActions: () => false,
  })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation(() => ({
      result: {
        tags: [],
      },
    })),
  }),
}));

const mockUsePanelContext = jest.mocked(usePanelContext);

const uplotMock = jest.requireMock('uplot');
const uplotMockInstance = uplotMock();
uplotMockInstance.setData.mockImplementationOnce(() => {});

describe('AnnotationsPlugin2', () => {
  let hooks: Record<string, (u: uPlot) => {}> = {};
  let config: UPlotConfigBuilder;
  const setUp = (props?: Partial<React.ComponentProps<typeof AnnotationsPlugin2>>) => {
    function applyReady() {
      act(() => {
        //@ts-ignore
        hooks.ready(new uPlot());
      });
    }

    const result = render(
      <div>
        <AnnotationsPlugin2
          annotations={[mockAnnotationFrame]}
          config={config}
          timeZone={'browser'}
          newRange={null}
          setNewRange={function (newRange: TimeRange2 | null): void {}}
          replaceVariables={function (value: string, scopedVars?: ScopedVars, format?: string | Function): string {
            throw new Error('Function not implemented.');
          }}
          {...props}
        />
        <div id="grafana-portal-container"></div>
      </div>
    );

    applyReady();
    return result;
  };

  beforeEach(() => {
    hooks = {};
    config = {
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;
  });

  describe('all', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    describe.each([mockIRMAnnotation, mockIRMAnnotationRegion])('Tooltips', (frame) => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      it.each([userEvent.hover, userEvent.click])('avatar', async (event) => {
        setUp({ annotations: [frame] });
        const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
        expect(firstMarker).toBeVisible();
        await event(firstMarker);
        expect(screen.queryByTestId('mock-annotation-title')).toBeVisible();
        expect(screen.queryByTestId('mock-annotation-text')).toBeVisible();
        expect(screen.queryByTestId('mock-annotation-text')?.querySelector('img')).toBeVisible();
      });
      it.each([userEvent.hover, userEvent.click])('text', async (event) => {
        setUp({ annotations: [frame] });
        const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
        expect(firstMarker).toBeVisible();
        await event(firstMarker);
        expect(screen.queryByTestId('mock-annotation-text')).toBeVisible();
        expect(screen.queryByTestId('mock-annotation-text')).toHaveTextContent(
          'A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation. Declared by your mom'
        );
      });
      it.each([userEvent.hover, userEvent.click])('title', async (event) => {
        setUp({ annotations: [frame] });
        const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
        expect(firstMarker).toBeVisible();
        await event(firstMarker);
        expect(screen.queryByTestId('mock-annotation-title')).toBeVisible();
        expect(screen.queryByTestId('mock-annotation-title')).toHaveTextContent('prod-000-writes-error');
      });
      it.each([userEvent.hover, userEvent.click])('inline links', async (event) => {
        setUp({ annotations: [frame] });
        const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
        expect(thirdMarker).toBeVisible();
        await event(thirdMarker);
        const titleLink = screen.queryByTestId('mock-annotation-title');
        expect(titleLink).toBeVisible();
        expect(titleLink).toHaveAttribute('href', '/a/grafana-irm-app/incidents/4683');
        expect(titleLink).toHaveAttribute('target', '_blank');
        expect(titleLink).toHaveTextContent('Vendor BYOC cell Failed to get annotations');
      });
      it.each([userEvent.hover, userEvent.click])('tags', async (event) => {
        const expectedTags = [
          'service:dashboard-service',
          'service:datasources',
          'squad:alerting',
          'squad:databases-sre',
          'squad:insights',
          'squad:loki',
        ];
        setUp({ annotations: [frame] });
        const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
        expect(thirdMarker).toBeVisible();
        await event(thirdMarker);
        const tags = screen.getAllByTestId('annotation-tag');

        expectedTags.forEach((tag, index) => {
          expect(tags[index]).toBeVisible();
          expect(tags[index]).toHaveTextContent(tag);
        });
      });

      describe('pinning', () => {
        afterEach(() => {
          jest.restoreAllMocks();
        });
        it('pins on click', async () => {
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => false,
            canEditAnnotations: () => false,
            canDeleteAnnotations: () => false,
          } as PanelContext);

          setUp({ annotations: [frame] });
          const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
          expect(thirdMarker).toBeVisible();

          // Pin the annotation tooltip on click
          await userEvent.click(thirdMarker);

          // Focus is within the tooltip, on the first icon (in this case close since edit and delete are not defined)
          expect(screen.getByLabelText('Close')).toHaveFocus();

          // Can close tooltip via keyboard press
          await userEvent.keyboard('{Enter}');

          expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
        });

        it('pins on keyboard', async () => {
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => false,
            canEditAnnotations: () => false,
            canDeleteAnnotations: () => false,
          } as PanelContext);

          setUp({ annotations: [frame] });
          const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
          expect(thirdMarker).toBeVisible();

          // Pin the annotation tooltip on focus
          act(() => {
            thirdMarker.focus();
          });
          expect(thirdMarker).toHaveFocus();

          // Verify the tooltip is rendered
          expect(screen.queryByTestId('mock-annotation-title')).toBeVisible();

          // But the close button isn't rendered until pinned
          expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();

          // Pin the annotation tooltip
          await userEvent.keyboard('{Enter}');

          // Focus is within the tooltip, on the first icon (in this case close since edit and delete are not defined)
          expect(screen.getByLabelText('Close')).toHaveFocus();

          // Can close tooltip via keyboard press
          await userEvent.keyboard('{Enter}');

          // Assert tooltip is now closed
          expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
          expect(screen.queryByTestId('mock-annotation-title')).not.toBeInTheDocument();
        });
      });

      describe('editing & deleting', () => {
        afterEach(() => {
          jest.restoreAllMocks();
        });

        it.each([userEvent.hover, userEvent.click])(
          'actions not visible if can execute actions is not set',
          async (event) => {
            mockUsePanelContext.mockReturnValue({
              canExecuteActions: () => false,
              canEditAnnotations: () => false,
              canDeleteAnnotations: () => false,
            } as PanelContext);
            setUp({ annotations: [frame] });
            const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
            expect(thirdMarker).toBeVisible();
            await event(thirdMarker);
            const editButton = screen.queryByLabelText('Edit');
            expect(editButton).not.toBeInTheDocument();
            const deleteButton = screen.queryByLabelText('Delete');
            expect(deleteButton).not.toBeInTheDocument();
          }
        );

        it.each([userEvent.hover, userEvent.click])('edit', async (event) => {
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => true,
            canEditAnnotations: () => true,
            canDeleteAnnotations: () => false,
          } as PanelContext);
          setUp({ annotations: [frame] });
          const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
          expect(markers).toHaveLength(3);
          // first marker cannot be edited or deleted since it has an id of 0
          const firstMarker = markers[0];
          await event(firstMarker);
          expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();

          const thirdMarker = markers[2];
          expect(thirdMarker).toBeVisible();
          await event(thirdMarker);
          const editButton = screen.getByLabelText('Edit');
          expect(editButton).toBeVisible();
          await userEvent.click(editButton);

          // Edit view has two editable fields, description and tags
          // Description input
          expect(screen.getByText('Description')).toBeVisible();
          const descriptionTextArea = screen.getByDisplayValue(/The vendor BYOC cell experienced annotation/);
          expect(descriptionTextArea).toBeVisible();

          // Tags input
          expect(screen.getByText('Tags')).toBeVisible();
          const tagButton = screen.getByLabelText('Remove squad:loki');
          expect(tagButton).toBeVisible();
        });

        it.each([userEvent.hover, userEvent.click])('delete', async (event) => {
          const onAnnotationDelete = jest.fn().mockImplementation((id: string) => {}) as (id: string) => void;
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => true,
            canEditAnnotations: () => true,
            canDeleteAnnotations: () => true,
            onAnnotationDelete,
          } as PanelContext);
          setUp({ annotations: [frame] });

          const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
          expect(markers).toHaveLength(3);
          // first marker cannot be edited or deleted since it has an id of 0
          const firstMarker = markers[0];
          await event(firstMarker);
          expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();

          const thirdMarker = markers[2];
          expect(thirdMarker).toBeVisible();
          await event(thirdMarker);
          const deleteButton = screen.getByLabelText('Delete');
          expect(deleteButton).toBeVisible();
          expect(onAnnotationDelete).not.toHaveBeenCalled();
          await userEvent.click(deleteButton);
          // from the 'id' field
          expect(onAnnotationDelete).toHaveBeenCalledWith(4683);
        });
      });
    });
  });
  describe('points', () => {
    it('should render', async () => {
      setUp();
      expect(screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker).length).toEqual(4);
    });

    describe('markers', () => {
      it.each([...allAnnotations])('all annotations should render', (frame) => {
        setUp({ annotations: [frame] });
        expect(screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker).length).toEqual(frame.length);
      });
      it('specified color should be used', () => {
        const { container } = setUp({ annotations: [mockIRMAnnotation] });
        const annotationButtons = container.querySelectorAll('button');
        expect(annotationButtons[0].getAttribute('style')).toMatch(/border-bottom-color: #F00;/);
        expect(annotationButtons[1].getAttribute('style')).toMatch(/border-bottom-color: #F0F;/);
        expect(annotationButtons[2].getAttribute('style')).toMatch(/border-bottom-color: #00F;/);
      });
    });

    describe('tooltips ', () => {
      it.each([userEvent.hover, userEvent.click])('time', async (event) => {
        setUp({ annotations: [mockIRMAnnotation] });
        const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
        expect(firstMarker).toBeVisible();
        await event(firstMarker);
        expect(screen.getByText('2025-10-02 02:08:15')).toBeVisible();
      });
    });
  });
  describe('regions', () => {
    it('should render', async () => {
      setUp();
      expect(screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker).length).toEqual(4);
    });

    describe('region markers', () => {
      it.each([allAnnotationRegions])('all annotation regions should render', (frame) => {
        setUp({ annotations: [frame] });
        expect(screen.getAllByTestId(selectors.pages.Dashboard.Annotations.marker).length).toEqual(frame.length);
      });

      it('background color should be used', () => {
        const { container } = setUp({ annotations: [mockIRMAnnotationRegion] });
        const annotationButtons = container.querySelectorAll('button');

        expect(annotationButtons[0].getAttribute('style')).toMatch(/background: rgb\(255, 0, 0\);/);
        expect(annotationButtons[0].getAttribute('style')).toMatch(/width: 89px/);
        expect(annotationButtons[1].getAttribute('style')).toMatch(/background: rgb\(255, 0, 255\);/);
        expect(annotationButtons[2].getAttribute('style')).toMatch(/background: rgb\(0, 0, 255\);/);
      });
    });

    describe('tooltips', () => {
      it.each([userEvent.hover, userEvent.click])('time', async (event) => {
        setUp({ annotations: [mockIRMAnnotation] });
        const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
        expect(firstMarker).toBeVisible();
        await event(firstMarker);
        expect(screen.getByText('2025-10-02 02:08:15')).toBeVisible();
      });
    });
  });

  describe('wip', () => {
    // Apparently you can command click and drag to create an annotation region? These might be better to test in e2e
    it.todo('can create annotation region');
    it.todo('can create annotation');
  });

  describe('annotation fields', () => {
    describe('alert state', () => {
      // when newState and alertId are both defined we show a custom alert header
      it('should render', async () => {
        setUp({
          annotations: [mockAlertingFrame],
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers).toHaveLength(11);

        await userEvent.hover(markers[0]);
        expect(screen.getByText('ALERTING')).toBeVisible();
      });
      // When alert state is defined we only render the annotation text, and not the title
      it('should not render annotation title', async () => {
        setUp({
          annotations: [mockAlertingFrame],
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers).toHaveLength(11);
        userEvent.hover(markers[0]);

        await userEvent.hover(markers[0]);
        expect(screen.queryByText('Title 1')).not.toBeInTheDocument();
      });
      it('should render text', async () => {
        setUp({
          annotations: [mockAlertingFrame],
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers).toHaveLength(11);

        await userEvent.hover(markers[0]);
        expect(screen.getByText('Launching HG Instance ops with hgrun version 1')).toBeVisible();
      });
      // The alert title currently renders after the text if the alertId and alertState is defined
      it('should render alert specific title', async () => {
        setUp({
          annotations: [mockAlertingFrame],
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers).toHaveLength(11);

        await userEvent.hover(markers[0]);
        expect(screen.getByText('Error: Alerting error test!')).toBeVisible();
      });
    });
  });

  describe('overrides', () => {
    it.todo('links');
    it.todo('actions');
  });
});
