import { css } from '@emotion/css';
import { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { Button, Drawer, ErrorBoundary, ErrorWithStack, Spinner, Text, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

import { ScopesInput } from './ScopesInput';
import { ScopesTree } from './ScopesTree';
import { useRecentScopes } from './useRecentScopes';
import { useScopeActions } from './useScopeActions';
import {
  useAppliedScopeIds,
  useAppliedScopes,
  useLoadingNodeName,
  useScopeNodesMap,
  useScopesMap,
  useScopesSelectorOpened,
  useScopesTree,
  useStagedScopes,
} from './useScopesSelectorState';

export const ScopesSelector = () => {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();

  // These must be called before any conditional returns (rules of hooks)
  const nodes = useScopeNodesMap();
  const scopesMap = useScopesMap();
  const appliedScopes = useAppliedScopes();
  const appliedScopeIds = useAppliedScopeIds();
  const selectedScopes = useStagedScopes();
  const tree = useScopesTree();
  const opened = useScopesSelectorOpened();
  const loadingNodeName = useLoadingNodeName();
  const { isAvailable, open, removeAllScopes, closeAndApply, closeAndReset, changeScopes } = useScopeActions();
  const recentScopes = useRecentScopes(appliedScopeIds);

  // Keyboard shortcut for closing and applying
  useEffect(() => {
    if (!isAvailable) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      // ctrl/cmd + enter. Do a check up here to prevent conditional useEffect
      if (event.key === 'Enter' && event.metaKey) {
        closeAndApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAvailable, closeAndApply]);

  if (!isAvailable || !scopes || !scopes.state.enabled) {
    return null;
  }

  const { loading } = scopes.state;

  return (
    <>
      <ScopesInput
        nodes={nodes}
        scopes={scopesMap}
        appliedScopes={appliedScopes}
        disabled={false}
        loading={loading}
        onInputClick={open}
        onRemoveAllClick={removeAllScopes}
      />

      {opened && (
        <Drawer title={t('scopes.selector.title', 'Select scopes')} size="sm" onClose={closeAndReset}>
          <ErrorBoundary boundaryName="scopes-selector">
            {({ error, errorInfo }) => {
              if (error) {
                return (
                  <ErrorWithStack
                    error={error}
                    title={t('scopes.selector.error-title', 'An unexpected error happened')}
                    errorInfo={errorInfo}
                  />
                );
              }
              return (
                <div className={styles.drawerContainer}>
                  <div className={styles.treeContainer}>
                    {loading || !tree ? (
                      <Spinner data-testid="scopes-selector-loading" />
                    ) : (
                      <>
                        <ScopesTree
                          tree={tree}
                          loadingNodeName={loadingNodeName}
                          recentScopes={recentScopes}
                          selectedScopes={selectedScopes}
                          scopeNodes={nodes}
                          onRecentScopesSelect={(scopeIds: string[], scopeNodeId?: string) => {
                            changeScopes(scopeIds, { scopeNodeId });
                            closeAndReset();
                          }}
                        />
                      </>
                    )}
                  </div>

                  <div className={styles.buttonsContainer}>
                    <Button variant="primary" data-testid="scopes-selector-apply" onClick={closeAndApply}>
                      <Trans i18nKey="scopes.selector.apply">Apply</Trans>&nbsp;
                      <Text variant="bodySmall">{`${getModKey()}+↵`}</Text>
                    </Button>
                    <Button variant="secondary" data-testid="scopes-selector-cancel" onClick={closeAndReset}>
                      <Trans i18nKey="scopes.selector.cancel">Cancel</Trans>
                    </Button>
                  </div>
                </div>
              );
            }}
          </ErrorBoundary>
        </Drawer>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    dashboards: css({
      color: theme.colors.text.secondary,

      '&:hover': css({
        color: theme.colors.text.primary,
      }),
    }),
    drawerContainer: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    treeContainer: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
      overflowY: 'hidden',
      // Fix for top level search outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    buttonsContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(8),
    }),
  };
};
