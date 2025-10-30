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
  getInteractiveLearningPluginId,
} from '../ExtensionSidebar/ExtensionSidebarProvider';

import { TopNavBarMenu } from './TopNavBarMenu';
import { useHelpNode } from './useHelpNode';

interface Props {
  isSmallScreen: boolean;
}

export const HelpTopBarButton = memo(function HelpTopBarButton({ isSmallScreen }: Props) {
  const enrichedHelpNode = useHelpNode();
  const { setDockedComponentId, dockedComponentId, availableComponents } = useExtensionSidebarContext();
  const styles = useStyles2(getStyles);

  if (!enrichedHelpNode) {
    return null;
  }

  const interactiveLearningPluginId = getInteractiveLearningPluginId(availableComponents);

  if (isSmallScreen || !enrichedHelpNode.hideFromTabs || interactiveLearningPluginId === undefined) {
    return (
      <Dropdown overlay={() => <TopNavBarMenu node={enrichedHelpNode} />} placement="bottom-end">
        <ToolbarButton
          iconOnly
          icon="question-circle"
          aria-label={t('navigation.help.aria-label', 'Help')}
          tooltip={t('navigation.help.tooltip', 'Help and documentation')}
        />
      </Dropdown>
    );
  }

  const componentId = getComponentIdFromComponentMeta(interactiveLearningPluginId, 'Interactive learning');
  const isOpen = dockedComponentId === componentId;

  return (
    <ToolbarButton
      iconOnly
      icon="question-circle"
      aria-label={t('navigation.help.aria-label', 'Help')}
      className={isOpen ? styles.helpButtonActive : undefined}
      tooltip={
        isOpen
          ? t('navigation.help.interactive-learning.close-tooltip', 'Close interactive learning, help and documentation')
          : t('navigation.help.interactive-learning.open-tooltip', 'Open interactive learning, help and documentation')
      }
      onClick={() => {
        if (isOpen) {
          setDockedComponentId(undefined);
        } else {
          const appEvents = getAppEvents();
          appEvents.publish(
            new OpenExtensionSidebarEvent({
              pluginId: interactiveLearningPluginId,
              componentTitle: 'Interactive learning',
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
