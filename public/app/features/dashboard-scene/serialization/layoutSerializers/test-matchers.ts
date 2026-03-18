import {
  Spec as DashboardV2Spec,
  AutoGridLayoutSpec,
  GridLayoutSpec,
  TabsLayoutSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeAutoGridLayout(): R;
      toBeAutoGridLayoutWith(fn: (spec: AutoGridLayoutSpec) => void): R;
      toBeAutoGridItem(): R;
      toBeAutoGridItemWith(fn: (item: AutoGridItem) => void): R;
      toBeGridLayout(): R;
      toBeGridLayoutWith(fn: (spec: GridLayoutSpec) => void): R;
      toBeDashboardGridItem(): R;
      toBeDashboardGridItemWith(fn: (item: DashboardGridItem) => void): R;
      toBeTabsLayout(): R;
      toBeTabsLayoutWith(fn: (spec: TabsLayoutSpec) => void): R;
    }
  }
}

function getReceivedName(received: unknown): string {
  if (typeof received === 'object' && received !== null) {
    return received.constructor?.name ?? typeof received;
  }
  return typeof received;
}

expect.extend({
  toBeAutoGridLayout(received: DashboardV2Spec['layout']) {
    const pass = received?.kind === 'AutoGridLayout';
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be AutoGridLayout, but got kind "${received.kind}"`
          : `expected layout to be AutoGridLayout, but got kind "${received.kind}"`,
    };
  },
  toBeAutoGridLayoutWith(received: DashboardV2Spec['layout'], fn: (spec: AutoGridLayoutSpec) => void) {
    const pass = received?.kind === 'AutoGridLayout';
    if (pass) {
      fn(received.spec);
    }
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be AutoGridLayout, but got kind "${received.kind}"`
          : `expected layout to be AutoGridLayout, but got kind "${received.kind}"`,
    };
  },
  toBeAutoGridItem(received: unknown) {
    const pass = received instanceof AutoGridItem;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be an AutoGridItem`
          : `expected value to be an AutoGridItem, but got ${getReceivedName(received)}`,
    };
  },
  toBeAutoGridItemWith(received: unknown, fn: (item: AutoGridItem) => void) {
    const pass = received instanceof AutoGridItem;
    if (pass) {
      fn(received);
    }
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be an AutoGridItem`
          : `expected value to be an AutoGridItem, but got ${getReceivedName(received)}`,
    };
  },
  toBeGridLayout(received: DashboardV2Spec['layout']) {
    const pass = received?.kind === 'GridLayout';
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be GridLayout, but got kind "${received.kind}"`
          : `expected layout to be GridLayout, but got kind "${received.kind}"`,
    };
  },
  toBeGridLayoutWith(received: DashboardV2Spec['layout'], fn: (spec: GridLayoutSpec) => void) {
    const pass = received?.kind === 'GridLayout';
    if (pass) {
      fn(received.spec);
    }
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be GridLayout, but got kind "${received.kind}"`
          : `expected layout to be GridLayout, but got kind "${received.kind}"`,
    };
  },
  toBeDashboardGridItem(received: unknown) {
    const pass = received instanceof DashboardGridItem;
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be a DashboardGridItem`
          : `expected value to be a DashboardGridItem, but got ${getReceivedName(received)}`,
    };
  },
  toBeDashboardGridItemWith(received: unknown, fn: (item: DashboardGridItem) => void) {
    const pass = received instanceof DashboardGridItem;
    if (pass) {
      fn(received);
    }
    return {
      pass,
      message: () =>
        pass
          ? `expected value not to be a DashboardGridItem`
          : `expected value to be a DashboardGridItem, but got ${getReceivedName(received)}`,
    };
  },
  toBeTabsLayout(received: DashboardV2Spec['layout']) {
    const pass = received?.kind === 'TabsLayout';
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be TabsLayout, but got kind "${received.kind}"`
          : `expected layout to be TabsLayout, but got kind "${received.kind}"`,
    };
  },
  toBeTabsLayoutWith(received: DashboardV2Spec['layout'], fn: (spec: TabsLayoutSpec) => void) {
    const pass = received?.kind === 'TabsLayout';
    if (pass) {
      fn(received.spec);
    }
    return {
      pass,
      message: () =>
        pass
          ? `expected layout not to be TabsLayout, but got kind "${received.kind}"`
          : `expected layout to be TabsLayout, but got kind "${received.kind}"`,
    };
  },
});
