import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import uPlot from 'uplot';

import { applyFieldOverrides, createTheme, FieldConfigOptionsRegistry } from '@grafana/data';
import { arrayToDataFrame, createDataFrame } from '@grafana/data/dataframe';
import { selectors } from '@grafana/e2e-selectors';
import { type PanelContext, type UPlotConfigBuilder, usePanelContext } from '@grafana/ui';
import { type TimeRange2 } from '@grafana/ui/internal';

import { AnnotationsPlugin2 } from './AnnotationsPlugin2';
import {
  allAnnotationRegions,
  allAnnotations,
  mockAlertingFrame,
  mockAnnotationFrame,
  mockIRMAnnotation,
  mockIRMAnnotationRegion,
} from './mocks/mockAnnotationFrames';
import { ANNOTATION_LANE_SIZE } from './utils';

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
  const setUp = (
    props?: Partial<React.ComponentProps<typeof AnnotationsPlugin2>>,
    configOverride?: UPlotConfigBuilder
  ) => {
    function applyReady() {
      act(() => {
        //@ts-ignore
        hooks.ready(new uPlot());
      });
    }

    const annotations = props?.annotations ?? [mockAnnotationFrame];
    const frames = annotations.map((fr) => createDataFrame(fr));
    // @todo we need to call applyFieldOverrides to add the link supplier to the frames on the frames in AnnotationsPlugin2
    const withOverrides = applyFieldOverrides({
      data: frames,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (value) => value,
      theme: createTheme(),
      fieldConfigRegistry: new FieldConfigOptionsRegistry(),
    });

    const result = render(
      <div>
        <AnnotationsPlugin2
          config={configOverride ?? config}
          timeZone={'browser'}
          newRange={null}
          setNewRange={function (newRange: TimeRange2 | null): void {}}
          replaceVariables={(value) => value}
          {...props}
          annotations={withOverrides}
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
      scales: [{ props: { scaleKey: 'x' } }, { props: { scaleKey: 'y' } }],
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
          'A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation. Declared by Batman'
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

        it('cannot hover other tooltips while pinned', async () => {
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => false,
            canEditAnnotations: () => false,
            canDeleteAnnotations: () => false,
          } as PanelContext);

          setUp({ annotations: [frame] });
          const thirdMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[2];
          const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
          expect(thirdMarker).toBeVisible();

          // Pin the annotation tooltip on click
          await userEvent.click(thirdMarker);

          expect(screen.queryByTestId('mock-annotation-title')).toBeVisible();
          expect(screen.queryByTestId('mock-annotation-title')).toHaveTextContent(
            'Vendor BYOC cell Failed to get annotations'
          );

          // Hover over another marker
          await userEvent.hover(firstMarker);

          // Should only be one title visible
          expect(screen.queryAllByTestId('mock-annotation-title')).toHaveLength(1);
          // The current tooltip should stay visible
          expect(screen.queryByTestId('mock-annotation-title')).toHaveTextContent(
            'Vendor BYOC cell Failed to get annotations'
          );
        });

        it('cannot hover other tooltips while wip is being edited', async () => {
          mockUsePanelContext.mockReturnValue({
            canExecuteActions: () => true,
            canEditAnnotations: () => true,
            canDeleteAnnotations: () => true,
          } as PanelContext);

          setUp({
            annotations: [frame],
            // newRange sets the wip annotation
            newRange: { from: minTime + 10, to: minTime + 10 },
          });

          // WIP edit state should be visible
          expect(screen.getByText('Add annotation')).toBeVisible();

          // Wip edit state should have close icon (like the pinned state)
          expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();

          const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
          const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];

          expect(firstMarker).toBeVisible();
          expect(markers).toHaveLength(4);

          // Hover over another marker that is not the wip anno
          await userEvent.hover(firstMarker);

          // Should only be one tooltip visible
          expect(screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.tooltip)).toHaveLength(1);

          // And it should be the wip edit tooltip
          expect(screen.getByText('Add annotation')).toBeVisible();

          // Close the wip anno
          await userEvent.click(screen.getByRole('button', { name: 'Close' }));

          expect(screen.queryByText('Add annotation')).not.toBeInTheDocument();
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
    // These might be better to test in e2e since they are generated in the parent viz component
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
  describe('options', () => {
    describe('multiRowAnnotations', () => {
      it('should render each frame into separate lanes in the viz', () => {
        setUp({
          annotations: [mockAlertingFrame, mockIRMAnnotationRegion],
          multiLane: true,
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers).toHaveLength(14);
        expect(markers[0].getAttribute('style')).toContain('top: 0px');
        expect(markers[13].getAttribute('style')).toContain(`top: ${ANNOTATION_LANE_SIZE}px`);
      });
    });
  });
  describe('overrides', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([userEvent.hover, userEvent.click])('links', async (event) => {
      setUp({
        annotations: [mockAlertingFrame],
      });
      const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
      await event(firstMarker);
      expect(screen.getByText('Link 1')).toBeVisible();
      expect(screen.getByText('Link 2')).toBeVisible();
    });

    it.each([userEvent.hover, userEvent.click])('actions', async (event) => {
      mockUsePanelContext.mockReturnValue({
        canExecuteActions: () => true,
      } as PanelContext);
      setUp({
        annotations: [mockAlertingFrame],
      });
      const firstMarker = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker)[0];
      await event(firstMarker);
      expect(screen.getByText('Action 1')).toBeVisible();
      expect(screen.getByText('Action 2')).toBeVisible();
    });
  });
  // These are somewhat fragile regression tests, but as long as the uplot draw hook implementation is not changed they should pass
  describe('uplot', () => {
    function createMockUPlot(overrides: Partial<uPlot> = {}): uPlot {
      const ctx = {
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        lineWidth: 0,
        setLineDash: jest.fn(),
        fillStyle: '',
        fillRect: jest.fn(),
        strokeStyle: '',
        strokeRect: jest.fn(),
        stroke: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
      } as unknown as CanvasRenderingContext2D;
      const valToPos = jest.fn().mockImplementation((val: number) => val);
      return {
        ctx,
        bbox: { left: 0, top: 0, width: 600, height: 200 },
        valToPos,
        root: { querySelector: jest.fn(() => null) },
        ...overrides,
      } as unknown as uPlot;
    }

    function invokeDrawHook(hooks: Record<string, (u: uPlot) => void>, mockU: uPlot) {
      if (hooks.draw) {
        hooks.draw(mockU);
      }
    }

    beforeEach(() => {
      hooks = {};
      config = {
        addHook: jest.fn((type, hook) => {
          hooks[type] = hook;
        }),
        scales: [{ props: { scaleKey: 'x' } }, { props: { scaleKey: 'y' } }],
      } as unknown as UPlotConfigBuilder;
    });

    describe('xAnnos', () => {
      it('should draw point annotations indicator lines', () => {
        setUp({ annotations: [mockAnnotationFrame] }, config);
        const mockU = createMockUPlot();
        const ctx = mockU.ctx as jest.Mocked<CanvasRenderingContext2D>;
        invokeDrawHook(hooks, mockU);
        expect(ctx.rect).toHaveBeenCalledWith(0, 0, 600, 200);
        expect(ctx.lineWidth).toBe(2);
        // The actual dashed line
        expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5]);
        // No region fill
        expect(ctx.fillRect).not.toHaveBeenCalled();
      });
      it('should draw region fill', () => {
        setUp({
          annotations: [mockIRMAnnotationRegion],
          canvasRegionRendering: true,
        });
        const mockU = createMockUPlot();
        const ctx = mockU.ctx as jest.Mocked<CanvasRenderingContext2D>;
        invokeDrawHook(hooks, mockU);
        // Also dashed lines
        expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5]);
        // Yes region fill
        expect(ctx.fillRect).toHaveBeenCalled();
      });
      it('multi-lane disables indicator line and rect fill', () => {
        setUp({
          annotations: [mockAnnotationFrame],
          multiLane: true,
        });
        const mockU = createMockUPlot();
        const ctx = mockU.ctx as jest.Mocked<CanvasRenderingContext2D>;
        invokeDrawHook(hooks, mockU);

        expect(ctx.stroke).not.toHaveBeenCalled();
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.setLineDash).not.toHaveBeenCalled();
      });
    });

    describe('xyAnnos', () => {
      const getXYMarkProps = (lineStyle: 'solid' | 'dash') => {
        const time = 0;
        const xMin = 10;
        const xMax = 100;
        const yMin = 20;
        const yMax = 50;
        const xymark = arrayToDataFrame([
          {
            time,
            xMin,
            xMax,
            yMin,
            yMax,
            isRegion: true,
            fillOpacity: 0.15,
            lineWidth: 1,
            lineStyle,
          },
        ]);
        xymark.name = 'xymark';
        return { xMin, xMax, yMin, yMax, xymark };
      };

      it('should render solid rect', () => {
        const { xMin, xMax, yMin, yMax, xymark } = getXYMarkProps('solid');
        setUp({ annotations: [xymark] }, config);
        const mockU = createMockUPlot();
        const ctx = mockU.ctx as jest.Mocked<CanvasRenderingContext2D>;
        invokeDrawHook(hooks, mockU);
        expect(ctx.fillRect).toHaveBeenNthCalledWith(1, xMin, yMax, xMax - xMin, yMin - yMax);
        expect(ctx.setLineDash).toHaveBeenCalledWith([]);
        expect(ctx.strokeRect).toHaveBeenCalledWith(xMin, yMax, xMax - xMin, yMin - yMax);
        expect(ctx.stroke).not.toHaveBeenCalled();
      });

      it('should render dashed rect', () => {
        const { xymark } = getXYMarkProps('dash');
        setUp({ annotations: [xymark] }, config);
        const mockU = createMockUPlot();
        const ctx = mockU.ctx as jest.Mocked<CanvasRenderingContext2D>;
        invokeDrawHook(hooks, mockU);
        expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5]);
      });
    });
  });
});
