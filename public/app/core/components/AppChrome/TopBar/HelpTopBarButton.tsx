import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import {
  useExtensionSidebarContext,
  getComponentIdFromComponentMeta,
} from '../ExtensionSidebar/ExtensionSidebarProvider';

import { TopNavBarMenu } from './TopNavBarMenu';
import { useHelpNavItem } from './useHelpNode';

interface Props {
  isSmallScreen: boolean;
}

export const HelpTopBarButton = memo(function HelpTopBarButton({ isSmallScreen }: Props) {
  const enrichedHelpNode = useHelpNavItem();
  const { setDockedComponentId, dockedComponentId, availableComponents } = useExtensionSidebarContext();
  const styles = useStyles2(getStyles);

  if (!enrichedHelpNode) {
    return null;
  }

  if (isSmallScreen || !enrichedHelpNode.hideFromTabs || !availableComponents.has('grafana-grafanadocsplugin-app')) {
    return (
      <Dropdown overlay={() => <TopNavBarMenu node={enrichedHelpNode} />} placement="bottom-end">
        <ToolbarButton iconOnly icon="question-circle" aria-label={t('navigation.help.aria-label', 'Help')} />
      </Dropdown>
    );
  }

  const componentId = getComponentIdFromComponentMeta('grafana-grafanadocsplugin-app', 'Grafana Pathfinder');
  const isOpen = dockedComponentId === componentId;

  return (
    <ToolbarButton
      iconOnly
      icon="question-circle"
      aria-label={t('navigation.help.aria-label', 'Help')}
      className={isOpen ? styles.helpButtonActive : undefined}
      onClick={() => {
        if (isOpen) {
          setDockedComponentId(undefined);
        } else {
          const appEvents = getAppEvents();
          appEvents.publish(
            new OpenExtensionSidebarEvent({
              pluginId: 'grafana-grafanadocsplugin-app',
              componentTitle: 'Grafana Pathfinder',
            })
          );
        }
      }}
    />
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  helpButtonActive: css({
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.primary.transparent,
    border: `1px solid ${theme.colors.primary.borderTransparent}`,
    color: theme.colors.text.primary,
  }),
});
