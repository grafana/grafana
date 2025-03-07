import { IconButton, Stack, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';

type Props = {
  title: string;
  onDelete: () => void;
};

export const ConditionHeader = ({ title, onDelete }: Props) => {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Text variant="h6">{title}</Text>
      <IconButton
        aria-label={t('dashboard.conditional-rendering.shared.delete-condition', 'Delete Condition')}
        name="trash-alt"
        onClick={() => onDelete()}
      />
    </Stack>
  );
};
