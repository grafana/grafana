import { Container, Text } from '@grafana/ui';
import { Step } from './types';
import { CodeBlock } from './CodeBlock';

export interface Props {
  step: Step;
}

export const SetupStep = ({ step }: Props) => {
  return (
    <>
      <Text element="h3" variant="h4">
        {step?.title}
      </Text>
      {step.description && (
        <Container margin="sm">
          <Text element="p">{step.description}</Text>
        </Container>
      )}

      {step.code && <CodeBlock code={step.code} copyCode={step.copyCode} />}
    </>
  );
};
