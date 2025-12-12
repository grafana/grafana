import { memo } from 'react';

import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Dropdown, ToolbarButton } from '@grafana/ui';
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

  if (!enrichedHelpNode) {
    return null;
  }

  const interactiveLearningPluginId = getInteractiveLearningPluginId(availableComponents);

  // Check if the component is actually registered, not just if the plugin exists
  // This allows plugins to conditionally register their sidebar component (e.g., for A/B testing)
  const componentId = interactiveLearningPluginId
    ? getComponentIdFromComponentMeta(interactiveLearningPluginId, 'Interactive learning')
    : undefined;

  // Show native help dropdown if:
  // - Screen is small (mobile/responsive), OR
  // - hideFromTabs is false, OR
  // - Interactive learning plugin is not installed, OR
  // - Interactive learning component is not registered (plugin may exist but chose not to register)
  if (isSmallScreen || !enrichedHelpNode.hideFromTabs || interactiveLearningPluginId === undefined || componentId === undefined) {
    return (
      <Dropdown overlay={() => <TopNavBarMenu node={enrichedHelpNode} />} placement="bottom-end">
        <ToolbarButton
          iconOnly
          icon="question-circle"
          aria-label={t('navigation.help.aria-label', 'Help')}
          tooltip={t('navigation.help.tooltip', 'Get help and useful links')}
        />
      </Dropdown>
    );
  }

  const isOpen = dockedComponentId === componentId;

  return (
    <ToolbarButton
      iconOnly
      icon="question-circle"
      aria-label={t('navigation.help.aria-label', 'Help')}
      variant={isOpen ? 'active' : 'default'}
      tooltip={
        isOpen
          ? t(
              'navigation.help.interactive-learning.close-tooltip',
              'Close interactive learning, help, and documentation'
            )
          : t('navigation.help.interactive-learning.open-tooltip', 'Open interactive learning, help, and documentation')
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