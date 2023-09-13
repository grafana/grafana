import afterFrame from 'afterframe';
import { ReactNode, useEffect } from 'react';

interface Props {
  children: any;
}

export const PanelPerformanceMonitor = (props: Props) => {
  performance.mark('test2 start');

  useEffect(() => {
    afterFrame(() => {
      // this.panelRenderTimeMs = performance.now() - this.panelRenderTimeMs;
      performance.mark('test2 end');
      const test = performance.measure('test2 duration', 'test2 start', 'test2 end');
      console.log(test);
      // debugger;
      // console.log(this.panelRenderTimeMs, " ms to render ", panel.plugin?.meta.name ?? "panel");
      // debugger;
      // faro.api.pushMeasurement(timeVal);
    });
  }, []);

  return props.children;
};
