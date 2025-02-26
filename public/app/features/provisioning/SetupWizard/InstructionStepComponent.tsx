import { Container, Text } from '@grafana/ui';
import { InstructionStep } from './types';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';

export interface Props {
  step: InstructionStep;
}

export const InstructionStepComponent = ({ step }: Props) => {
  return (
    <div>
      <Text element="h3" variant="h4">
        {step?.title}
      </Text>
      {step.description && (
        <Container margin="sm">
          <Text element="p">{step.description}</Text>
        </Container>
      )}

      {step.code && <CodeBlockWithCopy code={step.code} copyCode={step.copyCode} />}
    </div>
  );
};
