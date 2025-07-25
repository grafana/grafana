import { createContext, useAssistant } from '@grafana/assistant';
import { Button } from '@grafana/ui';

type Props = {
  assistantContext: Array<ReturnType<typeof createContext>>;
};

export function AnalyzeFlameGraph(props: Props) {
  const { assistantContext } = props;
  const [isAvailable, openAssistant] = useAssistant();

  if (!isAvailable || !openAssistant) {
    return null;
  }

  return (
    <Button
      onClick={() =>
        openAssistant({
          prompt: 'Analyze Flame Graph',
          context: assistantContext,
        })
      }
      variant="secondary"
      size="md"
    >
      Analyze Flame Graph
    </Button>
  );
}
