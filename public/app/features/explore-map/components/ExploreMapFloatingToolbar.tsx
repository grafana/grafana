import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ButtonGroup, Dropdown, Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { addPanel } from '../state/crdtSlice';

export function ExploreMapFloatingToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);

  const handleAddPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      })
    );
    setIsOpen(false);
  }, [dispatch]);

  const handleAddTracesDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'traces-drilldown',
      })
    );
    setIsOpen(false);
  }, [dispatch]);

  const handleAddMetricsDrilldownPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: 'metrics-drilldown',
      })
    );
    setIsOpen(false);
  }, [dispatch]);

  const MenuActions = () => (
    <Menu>
      <MenuItem
        label={t('explore-map.toolbar.add-panel', 'Add Explore panel')}
        icon="plus"
        onClick={handleAddPanel}
      />
      <MenuItem
        label={t('explore-map.toolbar.add-traces-drilldown-panel', 'Add Traces Drilldown panel')}
        icon="drilldown"
        onClick={handleAddTracesDrilldownPanel}
      />
      <MenuItem
        label={t('explore-map.toolbar.add-metrics-drilldown-panel', 'Add Metrics Drilldown panel')}
        icon="chart-line"
        onClick={handleAddMetricsDrilldownPanel}
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
