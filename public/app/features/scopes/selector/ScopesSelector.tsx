import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useMedia } from 'react-use';
import { Observable } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { Trans, t } from '@grafana/i18n';
import { useScopes } from '@grafana/runtime';
import { Button, Drawer, ErrorBoundary, ErrorWithStack, Spinner, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

import { useScopesServices } from '../ScopesContextProvider';

import { ScopesInput } from './ScopesInput';
import { ScopesSelectorPopover } from './ScopesSelectorPopover';
import { type ScopesSelectorServiceState } from './ScopesSelectorService';
import { ScopesTree } from './ScopesTree';
import { useRecentScopes } from './useRecentScopes';

export interface ScopesSelectorProps {
  /**
   * 'popover' floats the picker underneath the input, 'drawer' anchors it to the right edge of the screen.
   * Narrow viewports always use the drawer.
   */
  variant?: 'popover' | 'drawer';
}

export const ScopesSelector = ({ variant = 'popover' }: ScopesSelectorProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const isNarrow = useMedia(`(max-width: ${theme.breakpoints.values.md - 1}px)`);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const usePopover = variant === 'popover' && !isNarrow && anchor !== null;
  const scopes = useScopes();

  const services = useScopesServices();

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services?.scopesSelectorService.stateObservable ?? new Observable(),
    services?.scopesSelectorService.state
  );

  // Must be called before any conditional returns (rules of hooks)
  const appliedScopeIds = selectorServiceState?.appliedScopes.map((s) => s.scopeId) ?? [];
  const recentScopes = useRecentScopes(appliedScopeIds);

  // Keyboard shortcut for closing and applying
  useEffect(() => {
    if (!services?.scopesSelectorService) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      // ctrl/cmd + enter. Do a check up here to prevent conditional useEffect
      if (event.key === 'Enter' && event.metaKey) {
        services.scopesSelectorService.closeAndApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [services?.scopesSelectorService]);

  if (!services || !scopes || !scopes.state.enabled || !selectorServiceState) {
    return null;
  }

  const {
    nodes,
    loadingNodeName,
    opened,
    selectedScopes,
    appliedScopes,
    tree,
    scopes: scopesMap,
  } = selectorServiceState;
  const { scopesService, scopesSelectorService } = services;
  const { readOnly, loading } = scopes.state;
  const { open, removeAllScopes, closeAndApply, closeAndReset } = scopesSelectorService;

  const title = t('scopes.selector.title', 'Select scopes');
  const content = (
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
                      scopesSelectorService.changeScopes(scopeIds, undefined, scopeNodeId);
                      scopesSelectorService.closeAndReset();
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
  );

  return (
    <>
      <ScopesInput
        nodes={nodes}
        scopes={scopesMap}
        appliedScopes={appliedScopes}
        disabled={readOnly}
        loading={loading}
        onInputClick={() => {
          if (!scopesService.state.readOnly) {
            open();
          }
        }}
        onRemoveAllClick={removeAllScopes}
        inputRef={setAnchor}
      />

      {opened &&
        (usePopover ? (
          <ScopesSelectorPopover anchor={anchor} title={title} onClose={closeAndReset}>
            {content}
          </ScopesSelectorPopover>
        ) : (
          <Drawer title={title} size="sm" onClose={closeAndReset}>
            {content}
          </Drawer>
        ))}
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
      // Takes the remaining height so the buttons stay pinned to the bottom while the tree changes size
      flex: 1,
      minHeight: 0,
      overflowY: 'hidden',
      // Fix for top level search outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    buttonsContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      flexShrink: 0,
      marginTop: theme.spacing(2),
    }),
  };
};
