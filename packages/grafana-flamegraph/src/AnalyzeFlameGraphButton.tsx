import { ChatContextItem, useAssistant } from '@grafana/assistant';
import { Button } from '@grafana/ui';

type Props = {
  assistantContext: ChatContextItem[];
  className?: string;
};

export function AnalyzeFlameGraphButton(props: Props) {
  const { assistantContext, className } = props;
  const [isAvailable, openAssistant] = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return (
    <Button
      className={className}
      onClick={() =>
        openAssistant({
          prompt: 'Analyze Flame Graph',
          context: assistantContext,
        })
      }
      variant="secondary"
      fill="outline"
      icon="ai-sparkle"
      size="sm"
    >
      Analyze Flame Graph
    </Button>
  );
}
