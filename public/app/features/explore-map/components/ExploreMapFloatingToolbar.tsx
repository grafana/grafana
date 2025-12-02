import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ButtonGroup, Dropdown, Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import pyroscopeIconSvg from 'app/plugins/datasource/grafana-pyroscope-datasource/img/grafana_pyroscope_icon.svg';
import lokiIconSvg from 'app/plugins/datasource/loki/img/loki_icon.svg';
import prometheusLogoSvg from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';
import tempoLogoSvg from 'app/plugins/datasource/tempo/img/tempo_logo.svg';
import { useDispatch } from 'app/types/store';

import { addPanel } from '../state/crdtSlice';

export function ExploreMapFloatingToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const currentUsername = contextSrv.user.name || contextSrv.user.login || 'Unknown';

  const handleAddPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddTracesDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'traces-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddMetricsDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'metrics-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddProfilesDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'profiles-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const handleAddLogsDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'logs-drilldown',
        createdBy: currentUsername,
      })
    );
    setIsOpen(false);
  }, [dispatch, currentUsername]);

  const MenuActions = () => (
    <Menu>
      <MenuItem
        label={t('explore-map.toolbar.add-panel', 'Add Explore panel')}
        icon="compass"
        onClick={handleAddPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-metrics-drilldown-panel', 'Add Metrics Drilldown panel')}
        logoSrc={prometheusLogoSvg}
        logoAlt="Prometheus"
        onClick={handleAddMetricsDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-logs-drilldown-panel', 'Add Logs Drilldown panel')}
        logoSrc={lokiIconSvg}
        logoAlt="Loki"
        onClick={handleAddLogsDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-traces-drilldown-panel', 'Add Traces Drilldown panel')}
        logoSrc={tempoLogoSvg}
        logoAlt="Tempo"
        onClick={handleAddTracesDrilldownPanel}
      />
      <MenuItemWithLogo
        label={t('explore-map.toolbar.add-profiles-drilldown-panel', 'Add Profiles Drilldown panel')}
        logoSrc={pyroscopeIconSvg}
        logoAlt="Pyroscope"
        onClick={handleAddProfilesDrilldownPanel}
      />
    </Menu>
  );

  return (
    <div className={styles.floatingToolbar}>
      <ButtonGroup>
        <Button icon="plus" onClick={handleAddPanel} variant="primary">
          <Trans i18nKey="explore-map.toolbar.add-panel">Add panel</Trans>
        </Button>
        <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
          <Button
            aria-label={t('explore-map.toolbar.add-panel-dropdown', 'Add panel options')}
            variant="primary"
            icon={isOpen ? 'angle-up' : 'angle-down'}
          />
        </Dropdown>
      </ButtonGroup>
    </div>
  );
}

interface MenuItemWithLogoProps {
  label: string;
  logoSrc: string;
  logoAlt: string;
  onClick: () => void;
}

function MenuItemWithLogo({ label, logoSrc, logoAlt, onClick }: MenuItemWithLogoProps) {
  const styles = useStyles2(getMenuItemStyles);
  return (
    <div className={styles.menuItemWrapper}>
      <img src={logoSrc} alt={logoAlt} className={styles.logo} aria-hidden="true" />
      <MenuItem label={label} onClick={onClick} className={styles.menuItemWithLogo} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    floatingToolbar: css({
      position: 'fixed',
      bottom: theme.spacing(3),
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      zIndex: 1000,
    }),
  };
};

const getMenuItemStyles = (theme: GrafanaTheme2) => {
  return {
    menuItemWrapper: css({
      position: 'relative',
    }),
    logo: css({
      position: 'absolute',
      left: theme.spacing(1.5),
      top: '50%',
      transform: 'translateY(-50%)',
      width: '16px',
      height: '16px',
      flexShrink: 0,
      zIndex: 1,
      pointerEvents: 'none',
    }),
    menuItemWithLogo: css({
      paddingLeft: theme.spacing(4.5), // Make room for the logo
    }),
  };
};
