import { css } from '@emotion/css';

import { ToolbarButtonRow, useStyles2 } from '@grafana/ui';

import { dynamicDashNavActions } from '../../utils/registerDynamicDashNavAction';
import { DashboardScene } from '../DashboardScene';

import { ManagedDashboardBadge } from './actions/ManagedDashboardBadge';
import { OpenSnapshotOriginButton } from './actions/OpenSnapshotOriginButton';
import { PublicDashboardBadge } from './actions/PublicDashboardBadge';
import { StarButton } from './actions/StarButton';
import { getDynamicActions, renderActionElements, useIsManagedRepository } from './utils';

export const LeftActions = ({ dashboard }: { dashboard: DashboardScene }) => {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, uid, meta, viewPanelScene } = dashboard.useState();

  const hasEditView = Boolean(editview);
  const isViewingPanel = Boolean(viewPanelScene);
  const isEditingDashboard = Boolean(isEditing);
  const isEditingPanel = Boolean(editPanel);
  const isPublicDashboard = Boolean(meta.publicDashboardEnabled);
  const hasUid = Boolean(uid);
  const canEdit = Boolean(meta.canEdit);
  const canStar = Boolean(meta.canStar);
  const isSnapshot = Boolean(meta.isSnapshot);
  const isShowingDashboard = !hasEditView && !isViewingPanel && !isEditingPanel;
  const isManagedRepository = useIsManagedRepository(dashboard);

  const elements = renderActionElements(
    [
      // This adds the presence indicators in enterprise
      ...getDynamicActions(dynamicDashNavActions.left, 'left-dynamic', !isEditingPanel),
      {
        key: 'star-button',
        component: StarButton,
        group: 'actions',
        condition: hasUid && canStar && isShowingDashboard && !isEditingDashboard,
      },
      {
        key: 'public-dashboard-badge',
        component: PublicDashboardBadge,
        group: 'actions',
        condition: isPublicDashboard && hasUid && canStar && isShowingDashboard && !isEditingDashboard,
      },
      {
        key: 'managed-dashboard-badge',
        component: ManagedDashboardBadge,
        group: 'actions',
        condition: isManagedRepository && canEdit,
      },
      {
        key: 'open-snapshot-origin-button',
        component: OpenSnapshotOriginButton,
        group: 'actions',
        condition: isSnapshot && !isEditingDashboard,
      },
      // This adds the presence indicators in enterprise
      ...getDynamicActions(dynamicDashNavActions.right, 'right-dynamic', !isEditingPanel && !isEditingDashboard),
    ],
    dashboard
  );

  if (elements.length === 0) {
    return null;
  }

  return (
    <ToolbarButtonRow alignment="left" className={styles.container}>
      {elements}
    </ToolbarButtonRow>
  );
};

const getStyles = () => ({
  container: css({
    flex: 1,
  }),
});
