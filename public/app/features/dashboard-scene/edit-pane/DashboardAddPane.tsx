import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Box, Card, Icon, IconName, useStyles2 } from '@grafana/ui';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';

export interface Props {
  editPane: DashboardEditPane;
}

interface CardConfig {
  icon: IconName;
  heading: string;
  title: string;
  testId: string;
  onClick: () => void;
  hide?: boolean;
}

export function DashboardAddPane({ editPane }: Props) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(editPane);
  const [hasCopiedPanel, setHasCopiedPanel] = useState(store.exists(LS_PANEL_COPY_KEY));

  useEffect(() => {
    const unsubscribe = store.subscribe(LS_PANEL_COPY_KEY, () => {
      setHasCopiedPanel(store.exists(LS_PANEL_COPY_KEY));
    });

    return () => unsubscribe();
  }, []);

  const cards: CardConfig[] = [
    {
      icon: 'graph-bar',
      heading: t('dashboard.edit-pane.add.panel.heading', 'Panel'),
      title: t('dashboard.edit-pane.add.panel.title', 'A container for visualizations and other content'),
      testId: selectors.components.PageToolbar.itemButton('add_visualization'),
      onClick: () => dashboard.onCreateNewPanel(),
    },
    {
      icon: 'import',
      heading: t('dashboard.edit-pane.add.lib-panel.heading', 'Library panel'),
      title: t(
        'dashboard.edit-pane.add.lib-panel.title',
        'Library panels allow you share and reuse panels between dashboards'
      ),
      testId: selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item'),
      onClick: () => {
        dashboard.onShowAddLibraryPanelDrawer();
        DashboardInteractions.toolbarAddButtonClicked({ item: 'add_library_panel' });
      },
    },
    {
      icon: 'list-ul',
      heading: t('dashboard.edit-pane.add.row.heading', 'Row'),
      title: t('dashboard.edit-pane.add.row.title', 'A group of panels with an optional header'),
      testId: selectors.components.PageToolbar.itemButton('add_row'),
      onClick: () => dashboard.onCreateNewRow(),
    },
    {
      icon: 'layer-group',
      heading: t('dashboard.edit-pane.add.tab.heading', 'Tab'),
      title: t('dashboard.edit-pane.add.tab.title', 'Break up your dashboard into different horizontal tabs'),
      testId: selectors.components.PageToolbar.itemButton('add_tab'),
      onClick: () => dashboard.onCreateNewTab(),
    },
    {
      hide: !hasCopiedPanel,
      icon: 'clipboard-alt',
      heading: t('dashboard.edit-pane.add.paste-panel.heading', 'Paste panel'),
      title: t('dashboard.edit-pane.add.paste-panel.title', 'Paste a panel from the clipboard'),
      testId: selectors.components.PageToolbar.itemButton('paste_panel'),
      onClick: () => dashboard.pastePanel(),
    },
  ];

  return (
    <Box display="flex" direction="column" gap={1} padding={2}>
      {cards.map(({ icon, heading, title, testId, onClick, hide }) =>
        hide ? null : (
          <Card onClick={onClick} data-testid={testId} title={title} key={title}>
            <Card.Heading>{heading}</Card.Heading>
            <Card.Figure className={styles.figure}>
              <Icon name={icon} size="xl" />
            </Card.Figure>
          </Card>
        )
      )}
    </Box>
  );
}

const getStyles = () => ({
  figure: css({
    pointerEvents: 'none',
  }),
});
