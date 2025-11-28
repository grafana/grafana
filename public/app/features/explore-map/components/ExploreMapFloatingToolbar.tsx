import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { addPanel } from '../state/exploreMapSlice';

export function ExploreMapFloatingToolbar() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const handleAddPanel = useCallback(() => {
    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      })
    );
  }, [dispatch]);

  return (
    <div className={styles.floatingToolbar}>
      <Button icon="plus" onClick={handleAddPanel} variant="primary">
        <Trans i18nKey="explore-map.toolbar.add-panel">Add Panel</Trans>
      </Button>
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
