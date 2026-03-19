import { SceneObjectStateChangedEvent, VizPanel, SceneVariableSet } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/layout-default/DashboardGridItem';

import { LARGE_DASHBOARD_PANEL_THRESHOLD } from './collabEdgeCases';
import {
  extractMutationRequest,
  setLargeDashboardMode,
  suppressExtraction,
  unsuppressExtraction,
  isExtractionSuppressed,
} from './opExtractor';

function makeEvent(
  changedObject: unknown,
  partialUpdate: Record<string, unknown>,
  prevState: Record<string, unknown> = {},
  newState: Record<string, unknown> = {}
): SceneObjectStateChangedEvent {
  return new SceneObjectStateChangedEvent({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changedObject: changedObject as any,
    partialUpdate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prevState: prevState as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newState: newState as any,
  });
}

describe('opExtractor', () => {
  afterEach(() => {
    unsuppressExtraction();
  });

  describe('VizPanel → UPDATE_PANEL', () => {
    it('extracts title change as UPDATE_PANEL with correct Zod schema shape', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'New Title' });
      const event = makeEvent(panel, { title: 'New Title' });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_PANEL');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = result!.mutation.payload as any;
      expect(payload.element).toEqual({ kind: 'ElementReference', name: 'panel-1' });
      expect(payload.panel.spec.title).toBe('New Title');
      expect(result!.lockTarget).toBe('panel-1');
    });

    it('extracts description change as UPDATE_PANEL with correct Zod schema shape', () => {
      const panel = new VizPanel({ key: 'panel-2', pluginId: 'timeseries', title: 'Test' });
      const event = makeEvent(panel, { description: 'Updated description' });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_PANEL');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = result!.mutation.payload as any;
      expect(payload.element).toEqual({ kind: 'ElementReference', name: 'panel-2' });
      expect(payload.panel.spec.description).toBe('Updated description');
    });

    it('skips _renderCounter changes', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const event = makeEvent(panel, { _renderCounter: 5 });

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });

  });

  describe('DashboardGridItem → MOVE_PANEL', () => {
    it('extracts position change as MOVE_PANEL with correct Zod schema shape', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const gridItem = new DashboardGridItem({ body: panel, x: 10, y: 5, width: 12, height: 8 });

      const event = makeEvent(gridItem, { x: 10, y: 5 });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('MOVE_PANEL');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = result!.mutation.payload as any;
      expect(payload.element).toEqual({ kind: 'ElementReference', name: 'panel-1' });
      expect(payload.layoutItem.spec.x).toBe(10);
      expect(payload.layoutItem.spec.y).toBe(5);
      expect(result!.lockTarget).toBe('panel-1');
    });

    it('extracts size change as MOVE_PANEL', () => {
      const panel = new VizPanel({ key: 'panel-2', pluginId: 'timeseries', title: 'Test' });
      const gridItem = new DashboardGridItem({ body: panel, width: 24, height: 16 });

      const event = makeEvent(gridItem, { width: 24, height: 16 });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('MOVE_PANEL');
    });

    it('ignores non-position changes', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const gridItem = new DashboardGridItem({ body: panel });

      const event = makeEvent(gridItem, { variableName: 'foo' });

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });
  });

  describe('DashboardScene → UPDATE_DASHBOARD_INFO', () => {
    it('extracts title change', () => {
      const scene = new DashboardScene({ title: 'New Dashboard Title' });
      const event = makeEvent(scene, { title: 'New Dashboard Title' });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_DASHBOARD_INFO');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result!.mutation.payload as any).title).toBe('New Dashboard Title');
      expect(result!.lockTarget).toBe('__dashboard__');
    });

    it('extracts tags change', () => {
      const scene = new DashboardScene({ tags: ['prod', 'monitoring'] });
      const event = makeEvent(scene, { tags: ['prod', 'monitoring'] });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_DASHBOARD_INFO');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result!.mutation.payload as any).tags).toEqual(['prod', 'monitoring']);
    });

    it('extracts description change', () => {
      const scene = new DashboardScene({ description: 'Updated' });
      const event = makeEvent(scene, { description: 'Updated' });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_DASHBOARD_INFO');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result!.mutation.payload as any).description).toBe('Updated');
    });

    it('ignores non-dashboard-info changes', () => {
      const scene = new DashboardScene({});
      const event = makeEvent(scene, { isDirty: true });

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });
  });

  describe('SceneVariableSet → UPDATE_VARIABLE', () => {
    it('extracts variable set changes', () => {
      const varSet = new SceneVariableSet({ variables: [] });
      const event = makeEvent(varSet, { variables: [] });

      const result = extractMutationRequest(event);

      expect(result).not.toBeNull();
      expect(result!.mutation.type).toBe('UPDATE_VARIABLE');
      expect(result!.lockTarget).toBe('__variables__');
    });

    it('ignores non-variables changes on SceneVariableSet', () => {
      const varSet = new SceneVariableSet({ variables: [] });
      const event = makeEvent(varSet, { key: 'something' });

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });
  });

  describe('suppression', () => {
    it('returns null when extraction is suppressed', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const event = makeEvent(panel, { title: 'New Title' });

      suppressExtraction();
      expect(isExtractionSuppressed()).toBe(true);

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });

    it('extracts again after unsuppression', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const event = makeEvent(panel, { title: 'New Title' });

      suppressExtraction();
      expect(extractMutationRequest(event)).toBeNull();

      unsuppressExtraction();
      expect(isExtractionSuppressed()).toBe(false);

      const result = extractMutationRequest(event);
      expect(result).not.toBeNull();
    });
  });

  describe('large dashboard throttle (edge case #5)', () => {
    afterEach(() => {
      // Reset to non-throttled mode
      setLargeDashboardMode({ state: { body: { state: { children: [] } } } });
    });

    it('throttles extraction when panel count exceeds threshold', () => {
      const children = Array.from({ length: LARGE_DASHBOARD_PANEL_THRESHOLD + 1 }, (_, i) => i);
      setLargeDashboardMode({ state: { body: { state: { children } } } });

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });
      const event = makeEvent(panel, { title: 'A' });

      // First extraction succeeds
      const result1 = extractMutationRequest(event);
      expect(result1).not.toBeNull();

      // Immediate second extraction is throttled
      const result2 = extractMutationRequest(makeEvent(panel, { title: 'B' }));
      expect(result2).toBeNull();
    });

    it('does not throttle when panel count is below threshold', () => {
      setLargeDashboardMode({ state: { body: { state: { children: [1, 2, 3] } } } });

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', title: 'Test' });

      const result1 = extractMutationRequest(makeEvent(panel, { title: 'A' }));
      expect(result1).not.toBeNull();

      const result2 = extractMutationRequest(makeEvent(panel, { title: 'B' }));
      expect(result2).not.toBeNull();
    });
  });

  describe('unrecognized objects', () => {
    it('returns null for unknown scene object types', () => {
      const unknownObject = { state: { key: 'test' } };
      const event = makeEvent(unknownObject, { something: 'changed' });

      const result = extractMutationRequest(event);
      expect(result).toBeNull();
    });
  });
});
