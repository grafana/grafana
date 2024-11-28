import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config, useScopes } from '@grafana/runtime';
import { Button, Drawer, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t, Trans } from 'app/core/internationalization';

import { ScopesInput } from './internal/ScopesInput';
import { ScopesTree } from './internal/ScopesTree';

export const ScopesSelector = () => {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const styles = useStyles2(getStyles, menuDockedAndOpen);
  const { selector, dashboards } = useScopes();

  if (!selector.state.isEnabled) {
    return null;
  }

  const dashboardsIconLabel = selector.state.isReadOnly
    ? t('scopes.dashboards.toggle.disabled', 'Suggested dashboards list is disabled due to read only mode')
    : dashboards.state.isOpened
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
        disabled={selector.state.isReadOnly}
        onClick={() => dashboards.togglePanel()}
      />

      <ScopesInput
        nodes={selector.state.nodes}
        scopes={selector.state.scopes}
        isDisabled={selector.state.isReadOnly}
        isLoading={selector.state.isLoading}
        onInputClick={() => selector.open()}
        onRemoveAllClick={() => selector.removeAllScopes()}
      />

      {selector.state.isOpened && (
        <Drawer
          title={t('scopes.selector.title', 'Select scopes')}
          size="sm"
          onClose={() => {
            selector.close();
            selector.resetDirtyScopeNames();
          }}
        >
          <div className={styles.drawerContainer}>
            <div className={styles.treeContainer}>
              {selector.state.isLoading ? (
                <Spinner data-testid="scopes-selector-loading" />
              ) : (
                <ScopesTree
                  nodes={selector.state.nodes}
                  nodePath={['']}
                  loadingNodeName={selector.state.loadingNodeName}
                  scopes={selector.state.treeScopes}
                  onNodeUpdate={(path, isExpanded, query) => selector.updateNode(path, isExpanded, query)}
                  onNodeSelectToggle={(path) => selector.toggleNodeSelect(path)}
                />
              )}
            </div>

            <div className={styles.buttonsContainer}>
              <Button
                variant="primary"
                data-testid="scopes-selector-apply"
                onClick={() => {
                  selector.close();
                  selector.updateScopes();
                }}
              >
                <Trans i18nKey="scopes.selector.apply">Apply</Trans>
              </Button>
              <Button
                variant="secondary"
                data-testid="scopes-selector-cancel"
                onClick={() => {
                  selector.close();
                  selector.resetDirtyScopeNames();
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
