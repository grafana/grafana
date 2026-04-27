import { Text } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

interface Props {
  namespace: string;
  group?: string;
}

const RuleLocation = ({ namespace, group }: Props) => {
  if (!group) {
    return (
      <Text element="h3" variant="body">
        {namespace}
      </Text>
    );
  }

  return (
    <Text element="h3" variant="body">
      {namespace} <Icon name="angle-right" aria-label=">" /> {group}
    </Text>
  );
};

export { RuleLocation };
