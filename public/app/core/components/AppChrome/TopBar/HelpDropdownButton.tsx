import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  GrafanaTheme2,
  NavModelItem,
  PluginExtensionLink,
  PluginExtensionPoints,
  PluginExtensionTopbarHelpV1Context,
} from '@grafana/data';
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

const allowedPluginId = 'grafana-grafanadocsplugin-app';

export function HelpDropdownButton({ helpNode }: Props) {
  const styles = useStyles2(getStyles);
  const context = useMemo<PluginExtensionTopbarHelpV1Context>(() => ({ helpNode }), [helpNode]);
  const { dockedComponentId, isOpen: isSidebarOpen } = useExtensionSidebarContext();

  const { links, isLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TopbarHelpV1,
    context,
  });

  const link = useMemo(() => {
    return links.find((link) => link.pluginId === allowedPluginId);
  }, [links]);

  if (isLoading) {
    return null;
  }

  if (link) {
    return (
      <ToolbarButton
        iconOnly
        icon="question-circle"
        aria-label={t('navigation.help.aria-label', 'Help')}
        onClick={link.onClick}
        className={isOpenInSidebar(dockedComponentId, isSidebarOpen, link) ? styles.helpButtonActive : undefined}
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

function isOpenInSidebar(
  dockedComponentId: string | undefined,
  isSidebarOpen: boolean,
  link: PluginExtensionLink
): boolean {
  if (!isSidebarOpen) {
    return false;
  }
  if (!dockedComponentId) {
    return false;
  }
  const meta = getComponentMetaFromComponentId(dockedComponentId);
  if (!meta) {
    return false;
  }
  return meta.pluginId === link.pluginId && meta.componentTitle === link.title;
}
