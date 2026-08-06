import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useAssistantDifyContext } from '../assistant-dify/AssistantDifyContext';
import { useAssistantDifyIframeContext } from '../assistant-dify-iframe/AssistantDifyIframeContext';

import { useAssistantContext } from './AssistantContext';

export function AssistantButton() {
  const { isOpen, toggleAssistant, openAssistant } = useAssistantContext();
  const { isOpen: isDifyOpen, closeAssistant: closeDify } = useAssistantDifyContext();
  const { isOpen: isDifyIframeOpen, closeAssistant: closeDifyIframe } = useAssistantDifyIframeContext();

  const handleClick = () => {
    if (!isOpen && isDifyOpen) {
      closeDify();
    }
    if (!isOpen && isDifyIframeOpen) {
      closeDifyIframe();
    }
    if (isOpen) {
      toggleAssistant();
    } else {
      openAssistant();
    }
  };

  return (
    <ToolbarButton
      icon="ai-sparkle"
      iconOnly
      variant={isOpen ? 'active' : 'default'}
      onClick={handleClick}
      tooltip={
        isOpen
          ? t('navigation.assistant.close-tooltip', 'Close Grafana Assistant')
          : t('navigation.assistant.open-tooltip', 'Open Grafana Assistant')
      }
      aria-label={
        isOpen
          ? t('navigation.assistant.close-tooltip', 'Close Grafana Assistant')
          : t('navigation.assistant.open-tooltip', 'Open Grafana Assistant')
      }
    />
  );
}
