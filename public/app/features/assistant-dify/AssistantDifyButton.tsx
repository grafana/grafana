import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { useAssistantContext } from '../assistant/AssistantContext';

import { useAssistantDifyIframeContext } from '../assistant-dify-iframe/AssistantDifyIframeContext';

import { useAssistantDifyContext } from './AssistantDifyContext';

export function AssistantDifyButton() {
  const { isOpen, toggleAssistant, openAssistant } = useAssistantDifyContext();
  const { isOpen: isBasicOpen, closeAssistant: closeBasic } = useAssistantContext();
  const { isOpen: isDifyIframeOpen, closeAssistant: closeDifyIframe } = useAssistantDifyIframeContext();

  const handleClick = () => {
    if (!isOpen && isBasicOpen) {
      closeBasic();
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
      icon="message"
      iconOnly
      variant={isOpen ? 'active' : 'default'}
      onClick={handleClick}
      tooltip={
        isOpen
          ? t('navigation.assistant-dify.close-tooltip', 'Close Grafana Assistant (Dify)')
          : t('navigation.assistant-dify.open-tooltip', 'Open Grafana Assistant (Dify + Voice)')
      }
      aria-label={
        isOpen
          ? t('navigation.assistant-dify.close-tooltip', 'Close Grafana Assistant (Dify)')
          : t('navigation.assistant-dify.open-tooltip', 'Open Grafana Assistant (Dify + Voice)')
      }
    />
  );
}
