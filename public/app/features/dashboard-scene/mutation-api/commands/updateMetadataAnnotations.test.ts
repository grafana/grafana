import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyManagerKind, AnnoKeyUseCrossDashboardVariables, ManagerKind } from 'app/features/apiserver/types';

import type { DashboardScene } from '../../scene/DashboardScene';

import { updateMetadataAnnotationsCommand } from './updateMetadataAnnotations';

const CHANGE_PATH = `/metadata/annotations/${AnnoKeyUseCrossDashboardVariables}`;

function buildScene(
  options: {
    annotations?: Record<string, string>;
    canEdit?: boolean;
    managedLocked?: boolean;
  } = {}
): DashboardScene {
  const { annotations = {}, canEdit = true, managedLocked = false } = options;
  const meta = {
    k8s: { annotations: { ...annotations } },
  };

  const scene = {
    state: {
      isEditing: false,
      meta,
    },
    canEditDashboard: jest.fn(() => canEdit),
    managedResourceCannotBeEdited: jest.fn(() => managedLocked),
    onEnterEditMode: jest.fn(() => {
      scene.state.isEditing = true;
    }),
    activateSidebar: jest.fn(),
    setState: jest.fn((partial: { meta?: typeof meta }) => {
      if (partial.meta) {
        Object.assign(meta, partial.meta);
      }
    }),
    serializer: {
      getK8SMetadata: () => ({ annotations: { ...meta.k8s?.annotations } }),
      setK8SAnnotations: jest.fn((next: Record<string, string>) => {
        meta.k8s = { ...(meta.k8s ?? {}), annotations: next };
      }),
    },
    refreshPredefinedVariables: jest.fn().mockResolvedValue(undefined),
  };

  return scene as unknown as DashboardScene;
}

function selectionPayload(global: 'all' | 'none' | string[], folder: 'all' | 'none' | string[]) {
  return {
    annotations: {
      [AnnoKeyUseCrossDashboardVariables]: { global, folder },
    },
  };
}

describe('UPDATE_METADATA_ANNOTATIONS', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('refuses when the feature toggle is off', () => {
    const result = updateMetadataAnnotationsCommand.permission(buildScene());

    expect(result).toEqual({
      allowed: false,
      error: 'Cross-dashboard variables require the grafana.dashboardGlobalVariables feature toggle to be enabled.',
    });
  });

  it('refuses a locked managed dashboard even when the toggle is on', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene({
      managedLocked: true,
      annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo },
    });

    const result = updateMetadataAnnotationsCommand.permission(scene);

    expect(result).toEqual({
      allowed: false,
      error: 'Cannot edit cross-dashboard variables: dashboard is a managed resource',
    });
  });

  it('refuses when the dashboard cannot be edited', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });

    const result = updateMetadataAnnotationsCommand.permission(buildScene({ canEdit: false }));

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toContain('Cannot edit dashboard');
    }
  });

  it('writes a name-list selection onto metadata.annotations and refreshes', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene();

    const result = await updateMetadataAnnotationsCommand.handler(selectionPayload(['env'], 'none'), { scene });

    expect(result.success).toBe(true);
    expect(scene.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["env"],"folder":"none"}'
    );
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: { global: ['env'], folder: 'none' } },
    });
    expect(result.changes).toEqual([
      {
        path: CHANGE_PATH,
        previousValue: null,
        newValue: '{"global":["env"],"folder":"none"}',
      },
    ]);
    expect(scene.refreshPredefinedVariables).toHaveBeenCalled();
    expect(scene.onEnterEditMode).toHaveBeenCalledWith('assistant');
  });

  it('writes all for a scope', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}' },
    });

    const result = await updateMetadataAnnotationsCommand.handler(selectionPayload('all', 'none'), { scene });

    expect(result.success).toBe(true);
    expect(scene.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":"all","folder":"none"}'
    );
    expect(result.changes[0]).toEqual({
      path: CHANGE_PATH,
      previousValue: '{"global":["env"],"folder":"none"}',
      newValue: '{"global":"all","folder":"none"}',
    });
  });

  it('deletes the annotation when both scopes are none', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}' },
    });

    const result = await updateMetadataAnnotationsCommand.handler(selectionPayload('none', 'none'), { scene });

    expect(result.success).toBe(true);
    expect(scene.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: null },
    });
    expect(result.changes).toEqual([
      {
        path: CHANGE_PATH,
        previousValue: '{"global":"all","folder":"all"}',
        newValue: null,
      },
    ]);
  });

  it('deletes the annotation when the value is null', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}' },
    });

    const result = await updateMetadataAnnotationsCommand.handler(
      { annotations: { [AnnoKeyUseCrossDashboardVariables]: null } },
      { scene }
    );

    expect(result.success).toBe(true);
    expect(scene.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: null },
    });
    expect(result.changes[0].newValue).toBeNull();
  });

  it('drops grafana.app/ignorePredefinedVariables when writing', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    const scene = buildScene({
      annotations: { 'grafana.app/ignorePredefinedVariables': 'global:*' },
    });

    const result = await updateMetadataAnnotationsCommand.handler(selectionPayload('all', 'none'), { scene });

    expect(result.success).toBe(true);
    expect(Object.keys(scene.state.meta.k8s?.annotations ?? {})).toEqual([AnnoKeyUseCrossDashboardVariables]);
  });
});
