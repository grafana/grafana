/** @jest-environment jsdom */

// These tooltip cases exercise real DOMPurify sanitization, which requires jsdom.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import uPlot from 'uplot';

import {
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  dateTimeFormat,
  FieldConfigOptionsRegistry,
  systemDateFormats,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type PanelContext, type UPlotConfigBuilder, usePanelContext } from '@grafana/ui';
import { type TimeRange2 } from '@grafana/ui/internal';
import { DEFAULT_CLUSTERING_ANNOTATION_SPACING } from 'app/plugins/panel/timeseries/plugins/annotations/constants';

import { AnnotationsPlugin } from './AnnotationsPlugin';
import {
  mockAnnotationFrame,
  mockClusterRegions,
  mockIRMAnnotation,
  mockIRMAnnotationRegion,
  mockIRMClusteringAnnotation,
} from './mocks/mockAnnotationFrames';

const minTime = 1759388895560;
const maxTime = 1759390250000 + 1;
const plotWidth = 600;
// 2257.4ms per pixel (maxTime - minTime / plotWidth)
// 108355.2ms per cluster region (2257.4ms * 24px * 2)

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
  return jest.fn().mockImplementation((opts?: Partial<uPlot.Options>) => {
    return {
      ...jest.requireActual('uplot'),
      bbox: {
        show: true,
        left: 0,
        top: 0,
        width: plotWidth,
        height: plotWidth,
      },
      scales: {
        x: {
          min: minTime,
          max: maxTime,
        },
      },
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
      ...opts,
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

describe('AnnotationsPlugin', () => {
  let hooks: Record<string, (u: uPlot) => {}> = {};
  let config: UPlotConfigBuilder;
  const setUp = (
    props?: Partial<React.ComponentProps<typeof AnnotationsPlugin>>,
    configOverride?: UPlotConfigBuilder,
    uPlotProps?: Partial<uPlot.Options>,
    callReady = true
  ) => {
    function applyReady() {
      act(() => {
        //@ts-ignore
        hooks.ready(new uPlot(uPlotProps));
      });
    }

    function applyDrawAxes() {
      act(() => {
        //@ts-ignore
        hooks.drawAxes(new uPlot(uPlotProps));
      });
    }

    // Manually set static property
    uPlot.pxRatio = 2;

    const annotations = props?.annotations ?? [mockAnnotationFrame];
    const frames = annotations.map((fr) => createDataFrame(fr));
    // @todo we need to call applyFieldOverrides to add the link supplier to the frames on the frames in AnnotationsPlugin
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
        <AnnotationsPlugin
          options={{}}
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

    if (callReady) {
      applyReady();
      applyDrawAxes();
    }
    return result;
  };

  beforeEach(() => {
    hooks = {};
    config = {
      addHook: jest.fn((type, hook) => {
        // uPlot copies its hooks when it is built, so only the first hook registered for each type ever fires.
        hooks[type] ??= hook;
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

      describe('pinning', () => {
        afterEach(() => {
          jest.restoreAllMocks();
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
    });
  });

  describe('options', () => {
    describe('clustering', () => {
      it('should cluster points', async () => {
        // should cluster all points within 48px
        setUp({
          annotations: [mockIRMClusteringAnnotation],
          options: {
            clustering: DEFAULT_CLUSTERING_ANNOTATION_SPACING,
          },
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers.length).toEqual(2);
        await userEvent.click(markers[0]);

        // The first three annotations should get clustered, let's make sure the header includes the formatted time range
        const startTime = dateTimeFormat(mockIRMClusteringAnnotation.fields[2].values[0], {
          format: systemDateFormats.fullDate,
        });

        const endTime = dateTimeFormat(mockIRMClusteringAnnotation.fields[2].values[2], {
          format: systemDateFormats.fullDate,
        });

        expect(screen.getByText(`${startTime} - ${endTime}`));

        // Assert the tooltip body contains the title and the text
        const titles = screen.getAllByTestId('mock-annotation-title');
        expect(titles).toHaveLength(3);
        expect(titles[0]).toBeVisible();

        const texts = screen.getAllByTestId('mock-annotation-text');
        expect(texts).toHaveLength(3);
        expect(texts[0]).toBeVisible();

        // Assert all of the titles are rolled-up and rendered
        expect(titles[0]).toHaveTextContent('prod-000-writes-error');
        expect(titles[1]).toHaveTextContent('prod-001-writes-error');
        expect(titles[2]).toHaveTextContent('LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)');
        // Assert all of the text are rolled-up and rendered
        expect(texts[0]).toHaveTextContent('(>16MB)');
        expect(texts[1]).toHaveTextContent('(>32MB)');
        expect(texts[2]).toHaveTextContent('Declared by Ada');
      });
      it('should cluster regions', async () => {
        setUp({
          annotations: [mockClusterRegions],
          options: {
            clustering: DEFAULT_CLUSTERING_ANNOTATION_SPACING,
          },
        });
        const markers = screen.queryAllByTestId(selectors.pages.Dashboard.Annotations.marker);
        expect(markers.length).toEqual(1);
        await userEvent.click(markers[0]);

        // All annos should get clustered, format the dates from the raw frames
        const startTime = dateTimeFormat(mockClusterRegions.fields[2].values[0], {
          format: systemDateFormats.fullDate,
        });

        const endTime = dateTimeFormat(mockClusterRegions.fields[3].values[4], {
          format: systemDateFormats.fullDate,
        });

        expect(screen.getByText(`${startTime} - ${endTime}`));

        // Assert the tooltip body contains the title and the text
        const titles = screen.getAllByTestId('mock-annotation-title');
        expect(titles).toHaveLength(6);
        expect(titles[0]).toBeVisible();

        const texts = screen.getAllByTestId('mock-annotation-text');
        expect(texts).toHaveLength(6);
        expect(texts[0]).toBeVisible();

        // Assert all of the titles are rolled-up and rendered
        expect(titles[0]).toHaveTextContent('prod-000-writes-error');
        expect(titles[1]).toHaveTextContent('prod-001-writes-error');
        expect(titles[2]).toHaveTextContent('LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)');
        expect(titles[3]).toHaveTextContent('Vendor BYOC cell Failed to get annotations');
        expect(titles[4]).toHaveTextContent('Vendor BYOC cell Failed to get annotations');
        expect(titles[5]).toHaveTextContent('Vendor BYOC cell Failed to get annotations');
        // Assert all of the text are rolled-up and rendered
        expect(texts[0]).toHaveTextContent('(>16MB)');
        expect(texts[1]).toHaveTextContent('(>32MB)');
        expect(texts[2]).toHaveTextContent('Declared by Ada');
        expect(texts[3]).toHaveTextContent('Declared by Theo');
        expect(texts[4]).toHaveTextContent('Declared by Theo');
        expect(texts[5]).toHaveTextContent('Declared by Theo');
      });
    });
  });
});
