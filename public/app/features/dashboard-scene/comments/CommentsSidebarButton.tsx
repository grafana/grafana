import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Sidebar } from '@grafana/ui';

import { type DashboardEditPane } from '../edit-pane/DashboardEditPane';
import { type DashboardSidebarPane } from '../edit-pane/types';
import { DashboardInteractions } from '../utils/interactions';

import { CommentsPane } from './CommentsPane';

interface Props {
  editPane: DashboardEditPane;
  openPane: DashboardSidebarPane | undefined;
}

export function CommentsSidebarButton({ editPane, openPane }: Props) {
  const location = useLocation();
  const { uid = '' } = useParams();
  const active = new URLSearchParams(location.search).get('comments') === '1';

  if (!config.featureToggles.dashboardComments || !active) {
    return null;
  }

  const isOpen = openPane instanceof CommentsPane;
  return (
    <Sidebar.Button
      icon="comment-alt"
      onClick={() => {
        if (isOpen) {
          editPane.closePane();
        } else {
          DashboardInteractions.commentsPaneOpened({ dashboard_uid: uid, thread_count: 0 });
          editPane.openPane(new CommentsPane({}));
        }
      }}
      title={t('dashboard-scene.comments-sidebar.title', 'Comments')}
      tooltip={t('dashboard-scene.comments-sidebar.tooltip', 'Comments and collaborators')}
      active={isOpen}
    />
  );
}
