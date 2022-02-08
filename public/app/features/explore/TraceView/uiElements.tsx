import { Elements } from '@jaegertracing/jaeger-ui-components';

/**
 * Right now Jaeger components need some UI elements to be injected. This is to get rid of AntD UI library that was
 * used by default.
 */

// This needs to be static to prevent remounting on every render.
export const UIElements: Elements = {
  Menu: (() => null as any) as any,
  MenuItem: (() => null as any) as any,
};
