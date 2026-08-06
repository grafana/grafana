import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useAssistantContext } from '../assistant/AssistantContext';
import { useAssistantDifyContext } from '../assistant-dify/AssistantDifyContext';

import { useAssistantDifyIframeContext } from './AssistantDifyIframeContext';

export function AssistantDifyIframeButton() {
  const { isOpen, toggleAssistant, openAssistant } = useAssistantDifyIframeContext();
  const { isOpen: isBasicOpen, closeAssistant: closeBasic } = useAssistantContext();
  const { isOpen: isDifyOpen, closeAssistant: closeDify } = useAssistantDifyContext();

  const handleClick = () => {
    if (!isOpen && isBasicOpen) {
      closeBasic();
    }
    if (!isOpen && isDifyOpen) {
      closeDify();
    }
    if (isOpen) {
      toggleAssistant();
    } else {
      openAssistant();
    }
  };

  return (
    <ToolbarButton
      icon="window"
      iconOnly
      variant={isOpen ? 'active' : 'default'}
      onClick={handleClick}
      tooltip={
        isOpen
          ? t('navigation.assistant-dify-iframe.close-tooltip', 'Close Grafana Assistant (Dify iframe)')
          : t('navigation.assistant-dify-iframe.open-tooltip', 'Open Grafana Assistant (Dify iframe)')
      }
      aria-label={
        isOpen
          ? t('navigation.assistant-dify-iframe.close-tooltip', 'Close Grafana Assistant (Dify iframe)')
          : t('navigation.assistant-dify-iframe.open-tooltip', 'Open Grafana Assistant (Dify iframe)')
      }
    />
  );
}
