import { cloneDeep } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { SceneVariableSet, type SceneVariable, UrlSyncContextProvider } from '@grafana/scenes';
import { type VariableKind, defaultCustomVariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Alert, Button, ConfirmModal, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder, type Resource } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { sceneVariablesSetToSchemaV2Variables } from 'app/features/dashboard-scene/serialization/sceneVariablesSetToVariables';
import { createSceneVariableFromVariableModel } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { VariableEditorForm } from 'app/features/dashboard-scene/settings/variables/VariableEditorForm';
import {
  type EditableVariableType,
  getVariableScene,
  RESERVED_GLOBAL_VARIABLE_NAME_REGEX,
  WORD_CHARACTERS_REGEX,
} from 'app/features/dashboard-scene/settings/variables/utils';
import {
  getDashboardVariablesK8sClient,
  VARIABLE_FOLDER_LABEL_KEY,
} from 'app/features/dashboard-scene/utils/globalDashboardVariables';

import { GlobalDashboardVariablesTable } from './GlobalDashboardVariablesTable';

type FolderItemDTO = {
  uid: string;
  title: string;
  managedBy?: string;
};

type FolderInfoByUid = Record<string, FolderItemDTO>;
type RouteParams = { variableName?: string };

function isVariableKindSpec(spec: unknown): spec is VariableKind {
  return typeof spec === 'object' && spec !== null && 'kind' in spec && 'spec' in spec;
}

function variableKindFromSceneVariable(variable: SceneVariable): VariableKind {
  const variableSet = new SceneVariableSet({ variables: [variable] });
  new DashboardScene({ $variables: variableSet }, 'v2');
  const list = sceneVariablesSetToSchemaV2Variables(variableSet, true);
  const first = list[0];
  if (!first) {
    throw new Error('Could not serialize variable');
  }
  return first;
}

function stripSpecOrigin(v: VariableKind): VariableKind {
  const copy = cloneDeep(v);
  delete copy.spec.origin;
  return copy;
}

function validateGlobalVariableName(name: string): string | undefined {
  if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(name)) {
    return "Template names cannot begin with '__', that's reserved for Grafana's global variables";
  }
  if (!WORD_CHARACTERS_REGEX.test(name)) {
    return 'Only word characters are allowed in variable names';
  }
  return undefined;
}

async function listAllFolders(): Promise<FolderInfoByUid> {
  const limit = 50;
  let page = 1;
  const byUid: FolderInfoByUid = {};
  while (true) {
    const folders = await getBackendSrv().get<FolderItemDTO[]>('/api/folders', { page, limit });
    for (const folder of folders) {
      byUid[folder.uid] = folder;
    }
    if (folders.length < limit) {
      return byUid;
    }
    page += 1;
  }
}

export default function GlobalDashboardVariablesPage() {
  const { variableName } = useParams<RouteParams>();
  // The k8s client bakes the resolved API version into its URL at construction time
  // (ScopedResourceClient caches `this.url`). `dashboardAPIVersionResolver.getV2()`
  // returns a beta fallback when the resolver hasn't run yet — which is exactly the
  // state on a fresh reload of this page (no prior dashboard load to trigger resolve).
  // Defer client construction until after resolution so the URL points at the version
  // where the backend actually registers the Variables resource (v2).
  const [client, setClient] = useState<ReturnType<typeof getDashboardVariablesK8sClient> | null>(null);
  const [items, setItems] = useState<Array<Resource<VariableKind>>>([]);
  const [foldersByUid, setFoldersByUid] = useState<FolderInfoByUid>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [routeError, setRouteError] = useState<string>();
  const [editing, setEditing] = useState<Resource<VariableKind> | 'new' | null>(null);
  const [folderUid, setFolderUid] = useState<string | undefined>();
  const [variableScene, setVariableScene] = useState<SceneVariable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resource<VariableKind> | null>(null);

  const variableSet = useMemo(
    () => (variableScene ? new SceneVariableSet({ variables: [variableScene] }) : null),
    [variableScene]
  );
  const titleCollator = useMemo(() => new Intl.Collator(), []);
  const tableGroups = useMemo(() => {
    const orgVariables: Array<Resource<VariableKind>> = [];
    const variablesByFolder = new Map<string, Array<Resource<VariableKind>>>();

    for (const item of items) {
      const folderUid = item.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY];
      if (!folderUid) {
        orgVariables.push(item);
        continue;
      }

      const folderInfo = foldersByUid[folderUid];
      if (folderInfo?.managedBy) {
        continue;
      }

      const list = variablesByFolder.get(folderUid) ?? [];
      list.push(item);
      variablesByFolder.set(folderUid, list);
    }

    const folderGroups = Array.from(variablesByFolder.entries())
      .map(([folderUid, variables]) => ({
        id: `folder:${folderUid}`,
        title:
          foldersByUid[folderUid]?.title ??
          t('global-variables.table.folder-fallback', 'Folder: {{uid}}', { uid: folderUid }),
        variables,
      }))
      .sort((a, b) => titleCollator.compare(a.title, b.title));

    if (orgVariables.length > 0) {
      folderGroups.unshift({
        id: 'org',
        title: t('global-variables.table.organization', 'Organization'),
        variables: orgVariables,
      });
    }

    return folderGroups;
  }, [items, foldersByUid, titleCollator]);

  useEffect(() => {
    if (!config.featureToggles.globalDashboardVariables) {
      return;
    }
    let cancelled = false;
    dashboardAPIVersionResolver
      .resolve()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setClient(getDashboardVariablesK8sClient());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadList = useCallback(async () => {
    if (!client) {
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    try {
      const [rsp, folders] = await Promise.all([client.list({}), listAllFolders().catch(() => ({}))]);
      setItems(rsp.items);
      setFoldersByUid(folders);
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }
    reloadList();
  }, [client, reloadList]);

  useEffect(() => {
    if (!variableName) {
      setRouteError(undefined);
      if (editing && editing !== 'new') {
        setEditing(null);
        setVariableScene(null);
        setFolderUid(undefined);
      }
      return;
    }

    if (loading) {
      return;
    }

    const row = items.find((item) => item.metadata.name === variableName);
    if (!row) {
      setRouteError(
        t('global-variables.page.variable-not-found', 'Variable "{{name}}" was not found.', {
          name: variableName,
        })
      );
      setEditing(null);
      setVariableScene(null);
      return;
    }

    setRouteError(undefined);
    if (editing === 'new' || editing?.metadata.name !== row.metadata.name) {
      startEdit(row);
    }
  }, [editing, items, loading, variableName]);

  const openNew = () => {
    setFolderUid(undefined);
    const kind = defaultCustomVariableKind();
    kind.spec.name = 'newvariable';
    kind.spec.query = 'a,b,c';
    const v = createSceneVariableFromVariableModel(kind);
    setVariableScene(v);
    setEditing('new');
  };

  const startEdit = (row: Resource<VariableKind>) => {
    if (!isVariableKindSpec(row.spec)) {
      return;
    }
    const spec = row.spec;
    setFolderUid(row.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY]);
    const v = createSceneVariableFromVariableModel(spec);
    setVariableScene(v);
    setEditing(row);
  };

  const openEdit = (row: Resource<VariableKind>) => {
    locationService.push(`/dashboard/variables/${encodeURIComponent(row.metadata.name)}`);
    startEdit(row);
  };

  const onTypeChange = (type: EditableVariableType) => {
    if (!variableScene) {
      return;
    }
    const { name, label } = variableScene.state;
    const next = getVariableScene(type, { name, label });
    setVariableScene(next);
  };

  const onSave = async () => {
    if (!client || !variableScene) {
      return;
    }
    const err = validateGlobalVariableName(variableScene.state.name);
    if (err) {
      return;
    }

    let kind: VariableKind;
    try {
      kind = variableKindFromSceneVariable(variableScene);
    } catch (e) {
      console.error(e);
      return;
    }
    kind = stripSpecOrigin(kind);

    const annotations: Record<string, string> = {};
    if (editing && editing !== 'new') {
      for (const [key, value] of Object.entries(editing.metadata.annotations ?? {})) {
        if (typeof value === 'string') {
          annotations[key] = value;
        }
      }
    }
    if (folderUid) {
      annotations[AnnoKeyFolder] = folderUid;
    } else {
      delete annotations[AnnoKeyFolder];
    }

    try {
      if (editing === 'new') {
        await client.create({
          apiVersion: `dashboard.grafana.app/${dashboardAPIVersionResolver.getV2()}`,
          kind: 'Variable',
          metadata: {
            generateName: 'gv-',
            annotations,
          },
          spec: kind,
        });
      } else if (editing) {
        const row = editing;
        await client.update({
          ...row,
          metadata: {
            ...row.metadata,
            annotations,
          },
          spec: kind,
        });
      }
      setEditing(null);
      setVariableScene(null);
      locationService.push('/dashboard/variables');
      await reloadList();
    } catch (e) {
      console.error(e);
    }
  };

  const onDelete = async () => {
    if (!client || !deleteTarget?.metadata?.name) {
      return;
    }
    try {
      await client.delete(deleteTarget.metadata.name, true);
      setDeleteTarget(null);
      await reloadList();
    } catch (e) {
      console.error(e);
    }
  };

  if (!config.featureToggles.globalDashboardVariables) {
    return (
      <Page navId="dashboards/browse" layout={PageLayoutType.Standard} className="">
        <Page.Contents>
          <Alert title={t('global-variables.page.disabled', 'Feature disabled')} severity="info">
            {t(
              'global-variables.page.disabled-message',
              'Enable the globalDashboardVariables feature toggle to manage dashboard variables.'
            )}
          </Alert>
        </Page.Contents>
      </Page>
    );
  }

  if (!contextSrv.isEditor) {
    return (
      <Page navId="dashboards/browse" layout={PageLayoutType.Standard}>
        <Page.Contents>
          <Alert title={t('global-variables.page.access-denied', 'Access denied')} severity="error">
            {t('global-variables.page.editor-only', 'Only editors and administrators can manage global variables.')}
          </Alert>
        </Page.Contents>
      </Page>
    );
  }

  const pageNav = {
    text: t('global-variables.page.nav', 'Variables'),
    url: '/dashboard/variables',
    subTitle: t('global-variables.page.subtitle', 'Organization and folder-scoped dashboard variables'),
  };
  const detailPageNav =
    editing && editing !== 'new'
      ? {
          text: editing.spec.spec.name ?? editing.metadata.name,
          url: `/dashboard/variables/${encodeURIComponent(editing.metadata.name)}`,
          parentItem: pageNav,
        }
      : pageNav;

  if (editing && variableScene && variableSet) {
    return (
      <Page navId="dashboards/variables" pageNav={detailPageNav} layout={PageLayoutType.Standard}>
        <Page.Contents>
          <Stack direction="column" gap={2}>
            <div>
              <Text element="p" variant="bodySmall" color="secondary">
                {t(
                  'global-variables.page.folder-help',
                  'Optional: scope this variable to a folder. Leave empty for org-wide.'
                )}
              </Text>
              <NestedFolderPicker
                value={folderUid}
                onChange={(uid) => setFolderUid(uid)}
                clearable
                showRootFolder
                permission="edit"
              />
            </div>
            <UrlSyncContextProvider scene={variableSet} updateUrlOnInit={false}>
              <VariableEditorForm
                variable={variableScene}
                onTypeChange={onTypeChange}
                onGoBack={() => {
                  setEditing(null);
                  setVariableScene(null);
                  locationService.push('/dashboard/variables');
                }}
                onDelete={() => {}}
                hideDelete
              />
            </UrlSyncContextProvider>
            <Stack>
              <Button variant="primary" onClick={onSave}>
                {t('global-variables.page.save', 'Save')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setVariableScene(null);
                  locationService.push('/dashboard/variables');
                }}
              >
                {t('global-variables.page.cancel', 'Cancel')}
              </Button>
            </Stack>
          </Stack>
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="dashboards/variables" pageNav={pageNav} layout={PageLayoutType.Standard}>
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <Stack justifyContent="flex-start">
            <Button icon="plus" onClick={openNew}>
              {t('global-variables.page.add', 'New variable')}
            </Button>
          </Stack>
          {loadError && (
            <Alert title={t('global-variables.page.load-error', 'Failed to load variables')} severity="error">
              {loadError}
            </Alert>
          )}
          {routeError && (
            <Alert title={t('global-variables.page.route-error', 'Variable not found')} severity="warning">
              {routeError}
            </Alert>
          )}
          {loading ? (
            <LoadingPlaceholder text={t('global-variables.page.loading', 'Loading...')} />
          ) : (
            <GlobalDashboardVariablesTable groups={tableGroups} onEdit={openEdit} onDelete={setDeleteTarget} />
          )}
        </Stack>
        {deleteTarget && (
          <ConfirmModal
            isOpen={true}
            title={t('global-variables.page.delete-title', 'Delete variable')}
            body={t('global-variables.page.delete-body', 'Delete this variable? Dashboards referencing it may break.')}
            confirmText={t('global-variables.page.delete-confirm', 'Delete')}
            onConfirm={onDelete}
            onDismiss={() => setDeleteTarget(null)}
          />
        )}
      </Page.Contents>
    </Page>
  );
}
