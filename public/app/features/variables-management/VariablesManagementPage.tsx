import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Button, ConfirmModal, EmptyState, Stack, Text, useStyles2 } from '@grafana/ui';
import { type Variable } from 'app/api/clients/dashboard/v2beta1';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { VariableEditorView } from './VariableEditorView';
import {
  bulkDeleteVariables,
  bulkMoveVariables,
  type BulkOperationResult,
  useFolderTitles,
  useListAllVariablesQuery,
} from './api';
import { MoveVariablesModal } from './components/MoveVariablesModal';
import { VariablesTable } from './components/VariablesTable';
import { buildVariablesTree, getVariableFolderUid, getVariableSpecName } from './utils';

const LIST_URL = '/dashboards/variables';

export default function VariablesManagementPage() {
  const styles = useStyles2(getStyles);
  const { name: editName } = useParams<{ name?: string }>();
  const location = useLocation();
  // The edit route (/edit/:name) always carries a name param, so a variable
  // named "new" (URL /edit/new) is never mistaken for the create route.
  const isNew = !editName && location.pathname.endsWith('/new');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<'move' | 'delete' | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: variables = [], isLoading, isError, error } = useListAllVariablesQuery();

  const folderUids = useMemo(
    () => [...new Set(variables.map(getVariableFolderUid).filter((uid): uid is string => Boolean(uid)))].sort(),
    [variables]
  );
  const folderTitles = useFolderTitles(folderUids);
  const tree = useMemo(() => buildVariablesTree(variables, folderTitles), [variables, folderTitles]);

  const selectedVariables = variables.filter((v) => v.metadata.name && selected.has(v.metadata.name));

  const onToggleFolder = (folderUid: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderUid)) {
        next.delete(folderUid);
      } else {
        next.add(folderUid);
      }
      return next;
    });
  };

  const onSetSelected = (names: string[], isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        if (isSelected) {
          next.add(name);
        } else {
          next.delete(name);
        }
      }
      return next;
    });
  };

  const notifyBulkResult = (result: BulkOperationResult, successMessage: string) => {
    if (result.succeeded > 0) {
      dispatch(notifyApp(createSuccessNotification(successMessage)));
    }
    for (const failure of result.failed) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('variables-management.bulk.failed', 'Failed to process variable "{{name}}"', { name: failure.name }),
            extractErrorMessage(failure.error, '')
          )
        )
      );
    }
    // Keep the variables that failed selected so a retry doesn't require re-finding them.
    setSelected(new Set(result.failed.map((failure) => failure.metadataName)));
  };

  const onBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const result = await bulkDeleteVariables(selectedVariables);
      notifyBulkResult(
        result,
        t('variables-management.bulk.deleted', '', {
          count: result.succeeded,
          defaultValue_one: '{{count}} variable deleted',
          defaultValue_other: '{{count}} variables deleted',
        })
      );
    } finally {
      setIsProcessing(false);
      setPendingAction(undefined);
    }
  };

  const onBulkMove = async (targetFolderUid: string | undefined) => {
    setIsProcessing(true);
    try {
      const result = await bulkMoveVariables(selectedVariables, targetFolderUid);
      notifyBulkResult(
        result,
        t('variables-management.bulk.moved', '', {
          count: result.succeeded,
          defaultValue_one: '{{count}} variable moved',
          defaultValue_other: '{{count}} variables moved',
        })
      );
      if (result.skipped > 0) {
        dispatch(
          notifyApp(
            createSuccessNotification(
              t('variables-management.bulk.move-skipped', '', {
                count: result.skipped,
                defaultValue_one: '{{count}} variable was already in the selected folder',
                defaultValue_other: '{{count}} variables were already in the selected folder',
              })
            )
          )
        );
      }
    } finally {
      setIsProcessing(false);
      setPendingAction(undefined);
    }
  };

  const backToList = () => locationService.push(LIST_URL);
  const onEdit = (variable: Variable) => {
    if (variable.metadata.name) {
      locationService.push(`${LIST_URL}/edit/${encodeURIComponent(variable.metadata.name)}`);
    }
  };

  if (isNew || editName) {
    const editVariable = editName ? variables.find((v) => v.metadata.name === editName) : undefined;
    const existingNames = variables.map(getVariableSpecName);
    const pageNav: NavModelItem = {
      text: isNew
        ? t('variables-management.editor-nav.new', 'New variable')
        : editVariable
          ? getVariableSpecName(editVariable)
          : (editName ?? ''),
    };
    // Wait for the list before mounting /new so the default name can skip collisions.
    // If the list failed, still allow create with whatever names we have (may be empty).
    const showNewEditor = isNew && (!isLoading || isError);
    return (
      <Page navId="dashboards/variables" pageNav={pageNav}>
        <Page.Contents isLoading={isNew ? isLoading && !isError : isLoading}>
          {showNewEditor || editVariable ? (
            // Key by route identity so local editor state resets when navigating
            // between /edit/:name URLs (or to /new) without unmounting the page.
            <VariableEditorView
              key={editName ?? 'new'}
              source={editVariable}
              existingNames={existingNames}
              onBack={backToList}
            />
          ) : isNew ? null : isError ? (
            // Don't claim "not found" when the list simply failed to load.
            <LoadVariablesError error={error} onBack={backToList} />
          ) : (
            <EmptyState
              variant="not-found"
              message={t('variables-management.editor-nav.not-found', 'Variable not found')}
              button={
                <Button variant="secondary" onClick={backToList}>
                  <Trans i18nKey="variables-management.editor-nav.back-to-list">Back to variables</Trans>
                </Button>
              }
            />
          )}
        </Page.Contents>
      </Page>
    );
  }

  // An error must never look like "no variables yet" — the CTA would be misleading.
  const isEmpty = !isLoading && !isError && variables.length === 0;

  return (
    <Page
      navId="dashboards/variables"
      actions={
        !isEmpty && (
          <Button icon="plus" onClick={() => locationService.push(`${LIST_URL}/new`)}>
            <Trans i18nKey="variables-management.page.new-variable">New variable</Trans>
          </Button>
        )
      }
    >
      <Page.Contents isLoading={isLoading}>
        {isError ? (
          <LoadVariablesError error={error} />
        ) : isEmpty ? (
          <EmptyState
            variant="call-to-action"
            message={t('variables-management.page.empty-title', "You haven't created any variables yet")}
            button={
              <Button icon="plus" size="lg" onClick={() => locationService.push(`${LIST_URL}/new`)}>
                <Trans i18nKey="variables-management.page.empty-cta">New variable</Trans>
              </Button>
            }
          >
            <Trans i18nKey="variables-management.page.empty-body">
              Variables created here can be shared across dashboards, either globally or scoped to a folder.
            </Trans>
          </EmptyState>
        ) : (
          <div className={styles.content}>
            {selected.size > 0 && (
              <Stack gap={1} alignItems="center">
                <Text color="secondary">
                  {t('variables-management.page.selected-count', '', {
                    count: selected.size,
                    defaultValue_one: '{{count}} selected',
                    defaultValue_other: '{{count}} selected',
                  })}
                </Text>
                <Button variant="secondary" onClick={() => setPendingAction('move')} disabled={isProcessing}>
                  <Trans i18nKey="variables-management.page.move">Move</Trans>
                </Button>
                <Button variant="destructive" onClick={() => setPendingAction('delete')} disabled={isProcessing}>
                  <Trans i18nKey="variables-management.page.delete">Delete</Trans>
                </Button>
              </Stack>
            )}
            <VariablesTable
              tree={tree}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              selected={selected}
              onSetSelected={onSetSelected}
              onEdit={onEdit}
            />
          </div>
        )}

        {pendingAction === 'delete' && (
          <ConfirmModal
            isOpen
            title={t('variables-management.delete-modal.title', 'Delete variables')}
            body={t('variables-management.delete-modal.body', '', {
              count: selectedVariables.length,
              defaultValue_one: 'Are you sure you want to delete the variable "{{name}}"?',
              defaultValue_other: 'Are you sure you want to delete {{count}} variables?',
              name: selectedVariables[0] ? getVariableSpecName(selectedVariables[0]) : '',
            })}
            confirmText={t('variables-management.delete-modal.confirm', 'Delete')}
            onConfirm={onBulkDelete}
            onDismiss={() => setPendingAction(undefined)}
          />
        )}

        {pendingAction === 'move' && (
          <MoveVariablesModal
            count={selectedVariables.length}
            isMoving={isProcessing}
            onConfirm={onBulkMove}
            onDismiss={() => setPendingAction(undefined)}
          />
        )}
      </Page.Contents>
    </Page>
  );
}

function LoadVariablesError({ error, onBack }: { error: unknown; onBack?: () => void }) {
  return (
    <Alert severity="error" title={t('variables-management.page.load-error', 'Failed to load variables')}>
      <Stack direction="column" gap={1} alignItems="flex-start">
        {extractErrorMessage(error, '')}
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            <Trans i18nKey="variables-management.editor-nav.back-to-list">Back to variables</Trans>
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
});
