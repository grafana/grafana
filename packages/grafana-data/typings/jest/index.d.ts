import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Observable } from 'rxjs';
import type uPlot from 'uplot';

type ObservableType<T> = T extends Observable<infer V> ? V : never;

declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      toEmitValues<E = ObservableType<T>>(expected: E[]): Promise<CustomMatcherResult>;
      /**
       * Collect all the values emitted by the observables (also errors) and pass them to the expectations functions after
       * the observable ended (or emitted error). If Observable does not complete within OBSERVABLE_TEST_TIMEOUT_IN_MS the
       * test fails.
       */
      toEmitValuesWith<E = ObservableType<T>>(expectations: (received: E[]) => void): Promise<CustomMatcherResult>;

      /**
       * Canvas snapshot tests to be used on the output of jest-canvas-mock
       * Failed tests will generate a link to view the diff between canvas outputs
       * See public/app/plugins/panel/candlestick/utils.test.ts for an example
       *
       * @param uPlotEvents
       * @param size - optional canvas dimensions for the uplot-compare JSON payload
       * @param snapshotHint - optional Jest snapshot name passed to toMatchSnapshot
       */
      toMatchUPlotSnapshot(
        data: uPlot.AlignedData,
        series: uPlot.Series[],
        uPlotEvents: CanvasRenderingContext2DEvent[],
        size: { width: number; height: number },
        snapshotHint?: string
      ): CustomMatcherResult;
    }
  }
}
