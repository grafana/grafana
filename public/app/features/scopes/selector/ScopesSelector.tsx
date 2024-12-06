import { css } from '@emotion/css';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useScopes } from '@grafana/scenes';
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

  if (!scopes || !scopesSelectorService || !scopes.state.isEnabled) {
    return null;
  }

  const dashboardsIconLabel = scopes.state.isReadOnly
    ? t('scopes.dashboards.toggle.disabled', 'Suggested dashboards list is disabled due to read only mode')
    : scopes.state.isDrawerOpened
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
        disabled={scopes.state.isReadOnly}
        onClick={scopes.toggleDrawer}
      />

      <ScopesInput
        nodes={scopesSelectorService.state.nodes}
        scopes={scopesSelectorService.state.selectedScopes}
        isDisabled={scopes.state.isReadOnly}
        isLoading={scopes.state.isLoading}
        onInputClick={scopesSelectorService.openPicker}
        onRemoveAllClick={scopesSelectorService.removeAllScopes}
      />

      {scopesSelectorService.state.isOpened && (
        <Drawer
          title={t('scopes.selector.title', 'Select scopes')}
          size="sm"
          onClose={() => {
            scopesSelectorService!.closePicker();
            scopesSelectorService!.dismissNewScopes();
          }}
        >
          <div className={styles.drawerContainer}>
            <div className={styles.treeContainer}>
              {scopes.state.isLoading ? (
                <Spinner data-testid="scopes-selector-loading" />
              ) : (
                <ScopesTree
                  nodes={scopesSelectorService.state.nodes}
                  nodePath={['']}
                  loadingNodeName={scopesSelectorService.state.loadingNodeName}
                  scopes={scopesSelectorService.state.treeScopes}
                  onNodeUpdate={scopesSelectorService.updateNode}
                  onNodeSelectToggle={scopesSelectorService.toggleNodeSelect}
                />
              )}
            </div>

            <div className={styles.buttonsContainer}>
              <Button
                variant="primary"
                data-testid="scopes-selector-apply"
                onClick={() => {
                  scopesSelectorService!.closePicker();
                  scopesSelectorService!.applyNewScopes();
                }}
              >
                <Trans i18nKey="scopes.selector.apply">Apply</Trans>
              </Button>
              <Button
                variant="secondary"
                data-testid="scopes-selector-cancel"
                onClick={() => {
                  scopesSelectorService!.closePicker();
                  scopesSelectorService!.dismissNewScopes();
                }}
              >
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
      ...(!config.featureToggles.singleTopNav && {
        paddingLeft: theme.spacing(2),
        borderLeft: `1px solid ${theme.colors.border.weak}`,
      }),
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
