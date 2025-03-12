import { Badge, Box, Card, Stack, Text, Tooltip } from '@grafana/ui';

type Target = 'instance' | 'folder';
type Operation = 'pull' | 'migrate';

interface ModeOption {
  value: Target;
  operation: Operation;
  label: string;
  description: string;
}

interface OptionState {
  isDisabled: boolean;
  disabledReason?: string;
}

interface Props {
  option: ModeOption;
  isSelected: boolean;
  optionState: OptionState;
  index: number;
  onSelect: (option: ModeOption) => void;
  onChange: (value: Target) => void;
}

export function BootstrapOptionCard({ option, isSelected, optionState, index, onSelect, onChange }: Props) {
  if (optionState.isDisabled) {
    return (
      <Box paddingLeft={2} paddingRight={2}>
        <Tooltip content={optionState.disabledReason || ''} placement="top">
          <div style={{ pointerEvents: 'auto' }}>
            <div style={{ pointerEvents: 'none' }}>
              <Card disabled={true} tabIndex={-1}>
                <Card.Heading>
                  <Stack direction="row" alignItems="center" gap={2}>
                    <Text color="secondary">{option.label}</Text>
                    <Badge color="blue" text="Not available" icon="info" />
                  </Stack>
                </Card.Heading>
                <Card.Description>{option.description}</Card.Description>
              </Card>
            </div>
          </div>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Card
      isSelected={isSelected}
      onClick={() => {
        onChange(option.value);
        onSelect(option);
      }}
      tabIndex={0}
      autoFocus={index === 0}
    >
      <Card.Heading>
        <Text color="primary" element="h4">
          {option.label}
        </Text>
      </Card.Heading>
      <Card.Description>{option.description}</Card.Description>
    </Card>
  );
}
