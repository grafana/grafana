import { css } from '@emotion/css';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { useScopes } from '@grafana/runtime';
import { Button, Drawer, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t, Trans } from 'app/core/internationalization';

import { ScopesInput } from './ScopesInput';
import { ScopesSelectorService } from './ScopesSelectorService';
import { ScopesTree } from './ScopesTree';

export const ScopesSelector = () => {
  const { chrome } = useGrafana();
  const chromeState = chrome.useState();
  const menuDockedAndOpen = !chromeState.chromeless && chromeState.megaMenuDocked && chromeState.megaMenuOpen;
  const styles = useStyles2(getStyles, menuDockedAndOpen);
  const scopes = useScopes();

  const scopesSelectorService = ScopesSelectorService.instance;

  useObservable(scopesSelectorService?.stateObservable ?? new Observable(), scopesSelectorService?.state);

  if (!scopes || !scopesSelectorService || !scopes.state.enabled) {
    return null;
  }

  const { readOnly, drawerOpened, loading } = scopes.state;
  const { nodes, selectedScopes, opened, loadingNodeName, treeScopes } = scopesSelectorService.state;
  const { toggleDrawer, open, removeAllScopes, closeAndApply, closeAndReset, updateNode, toggleNodeSelect } =
    scopesSelectorService;

  const dashboardsIconLabel = readOnly
    ? t('scopes.dashboards.toggle.disabled', 'Suggested dashboards list is disabled due to read only mode')
    : drawerOpened
      ? t('scopes.dashboards.toggle.collapse', 'Collapse suggested dashboards list')
      : t('scopes.dashboards.toggle..expand', 'Expand suggested dashboards list');

  return (
    <div className={styles.container}>
      <IconButton
        name="web-section-alt"
        className={styles.dashboards}
        aria-label={dashboardsIconLabel}
        tooltip={dashboardsIconLabel}
        data-testid="scopes-dashboards-expand"
        disabled={readOnly}
        onClick={toggleDrawer}
      />

      <ScopesInput
        nodes={nodes}
        scopes={selectedScopes}
        disabled={readOnly}
        loading={loading}
        onInputClick={open}
        onRemoveAllClick={removeAllScopes}
      />

      {opened && (
        <Drawer title={t('scopes.selector.title', 'Select scopes')} size="sm" onClose={closeAndReset}>
          <div className={styles.drawerContainer}>
            <div className={styles.treeContainer}>
              {loading ? (
                <Spinner data-testid="scopes-selector-loading" />
              ) : (
                <ScopesTree
                  nodes={nodes}
                  nodePath={['']}
                  loadingNodeName={loadingNodeName}
                  scopes={treeScopes}
                  onNodeUpdate={updateNode}
                  onNodeSelectToggle={toggleNodeSelect}
                />
              )}
            </div>

            <div className={styles.buttonsContainer}>
              <Button variant="primary" data-testid="scopes-selector-apply" onClick={closeAndApply}>
                <Trans i18nKey="scopes.selector.apply">Apply</Trans>
              </Button>
              <Button variant="secondary" data-testid="scopes-selector-cancel" onClick={closeAndReset}>
                <Trans i18nKey="scopes.selector.cancel">Cancel</Trans>
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, menuDockedAndOpen: boolean) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      paddingLeft: menuDockedAndOpen ? theme.spacing(2) : 'unset',
    }),
    dashboards: css({
      color: theme.colors.text.secondary,
      marginRight: theme.spacing(2),

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
