import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, NavModelItem, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';

import {
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from '../ExtensionSidebar/ExtensionSidebarProvider';

import { TopNavBarMenu } from './TopNavBarMenu';

interface Props {
  helpNode: NavModelItem;
}

export function HelpDropdownButton({ helpNode }: Props) {
  const styles = useStyles2(getStyles);
  const context = useMemo(() => ({ helpNode }), [helpNode]);
  const { dockedComponentId, isOpen: isSidebarOpen } = useExtensionSidebarContext();

  const { links, isLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TopBarHelpButtonV1,
    context,
  });

  const pathfinderLink = useMemo(() => {
    return links.find((link) => link.pluginId === 'grafana-grafanadocsplugin-app');
  }, [links]);

  if (isLoading) {
    return null;
  }

  if (pathfinderLink) {
    return (
      <ToolbarButton
        iconOnly
        icon="question-circle"
        aria-label={t('navigation.help.aria-label', 'Help')}
        onClick={pathfinderLink.onClick}
        className={isOpenInSidebar(dockedComponentId, isSidebarOpen) ? styles.helpButtonActive : undefined}
      />
    );
  }

  return (
    <Dropdown overlay={() => <TopNavBarMenu node={helpNode} />} placement="bottom-end">
      <ToolbarButton iconOnly icon="question-circle" aria-label={t('navigation.help.aria-label', 'Help')} />
    </Dropdown>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    helpButtonActive: css({
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.primary.transparent,
      border: `1px solid ${theme.colors.primary.borderTransparent}`,
      color: theme.colors.text.primary,
    }),
  };
}

function isOpenInSidebar(dockedComponentId: string | undefined, isSidebarOpen: boolean): boolean {
  if (!isSidebarOpen) {
    return false;
  }
  if (!dockedComponentId) {
    return false;
  }
  const componentMeta = getComponentMetaFromComponentId(dockedComponentId);
  if (!componentMeta) {
    return false;
  }
  return (
    componentMeta.pluginId === 'grafana-grafanadocsplugin-app' && componentMeta.componentTitle === 'Grafana Pathfinder'
  );
}
