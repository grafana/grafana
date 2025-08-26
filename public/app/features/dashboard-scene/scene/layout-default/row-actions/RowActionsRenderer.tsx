import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, VizPanel } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { getQueryRunnerFor, useDashboard, useDashboardState } from '../../../utils/utils';
import { DashboardGridItem } from '../DashboardGridItem';
import { RowRepeaterBehavior } from '../RowRepeaterBehavior';

import { RowActions } from './RowActions';
import { RowOptionsButton } from './RowOptionsButton';

export function RowActionsRenderer({ model }: SceneComponentProps<RowActions>) {
  const row = model.getParent();
  const { title, children } = row.useState();
  const dashboard = useDashboard(model);
  const { meta, isEditing } = useDashboardState(model);
  const styles = useStyles2(getStyles);

  const isUsingDashboardDS = useMemo(
    () =>
      children.some((gridItem) => {
        if (!(gridItem instanceof DashboardGridItem)) {
          return false;
        }

        if (gridItem.state.body instanceof VizPanel) {
          const runner = getQueryRunnerFor(gridItem.state.body);
          return (
            runner?.state.datasource?.uid === SHARED_DASHBOARD_QUERY ||
            (runner?.state.datasource?.uid === MIXED_DATASOURCE_NAME &&
              runner?.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY))
          );
        }

        return false;
      }),
    [children]
  );

  const behaviour = row.state.$behaviors?.find((b) => b instanceof RowRepeaterBehavior);

  return (
    <>
      {meta.canEdit && isEditing && (
        <>
          <div className={styles.rowActions}>
            <RowOptionsButton
              title={title}
              repeat={behaviour instanceof RowRepeaterBehavior ? behaviour.state.variableName : undefined}
              parent={dashboard}
              onUpdate={(title, repeat) => model.onUpdate(title, repeat)}
              isUsingDashboardDS={isUsingDashboardDS}
            />
            <button
              type="button"
              onClick={() => model.onDelete()}
              aria-label={t('dashboard.default-layout.row-actions.delete', 'Delete row')}
            >
              <Icon name="trash-alt" />
            </button>
          </div>
        </>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    rowActions: css({
      color: theme.colors.text.secondary,
      lineHeight: '27px',

      button: {
        color: theme.colors.text.secondary,
        paddingLeft: theme.spacing(2),
        background: 'transparent',
        border: 'none',

        '&:hover': {
          color: theme.colors.text.maxContrast,
        },
      },
    }),
  };
};
