import { cloneDeep } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
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

export default function GlobalDashboardVariablesPage() {
  // The k8s client bakes the resolved API version into its URL at construction time
  // (ScopedResourceClient caches `this.url`). `dashboardAPIVersionResolver.getV2()`
  // returns a beta fallback when the resolver hasn't run yet — which is exactly the
  // state on a fresh reload of this page (no prior dashboard load to trigger resolve).
  // Defer client construction until after resolution so the URL points at the version
  // where the backend actually registers the Variables resource (v2).
  const [client, setClient] = useState<ReturnType<typeof getDashboardVariablesK8sClient> | null>(null);
  const [items, setItems] = useState<Array<Resource<VariableKind>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [editing, setEditing] = useState<Resource<VariableKind> | 'new' | null>(null);
  const [folderUid, setFolderUid] = useState<string | undefined>();
  const [variableScene, setVariableScene] = useState<SceneVariable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resource<VariableKind> | null>(null);

  const variableSet = useMemo(
    () => (variableScene ? new SceneVariableSet({ variables: [variableScene] }) : null),
    [variableScene]
  );

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
      const rsp = await client.list({});
      setItems(rsp.items);
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

  const openNew = () => {
    setFolderUid(undefined);
    const kind = defaultCustomVariableKind();
    kind.spec.name = 'newvariable';
    kind.spec.query = 'a,b,c';
    const v = createSceneVariableFromVariableModel(kind);
    setVariableScene(v);
    setEditing('new');
  };

  const openEdit = (row: Resource<VariableKind>) => {
    if (!isVariableKindSpec(row.spec)) {
      return;
    }
    const spec = row.spec;
    setFolderUid(row.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY]);
    const v = createSceneVariableFromVariableModel(spec);
    setVariableScene(v);
    setEditing(row);
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

    const annotations: Record<string, string> = {
      ...(editing !== 'new' && editing && editing !== 'new' ? editing.metadata.annotations : {}),
    };
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
      } else if (editing && editing !== 'new') {
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
      <Page navId="dashboards/browse" layout={PageLayoutType.Canvas}>
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
      <Page navId="dashboards/browse" layout={PageLayoutType.Canvas}>
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
    subTitle: t('global-variables.page.subtitle', 'Organization and folder-scoped dashboard variables'),
  };

  if (editing && variableScene && variableSet) {
    return (
      <Page navId="dashboards/variables" pageNav={pageNav} layout={PageLayoutType.Standard}>
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
    <Page navId="dashboards/variables" pageNav={pageNav} layout={PageLayoutType.Canvas}>
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
          {loading ? (
            <LoadingPlaceholder text={t('global-variables.page.loading', 'Loading...')} />
          ) : (
            <GlobalDashboardVariablesTable items={items} onEdit={openEdit} onDelete={setDeleteTarget} />
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
