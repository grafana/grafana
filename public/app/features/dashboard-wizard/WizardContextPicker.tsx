import { css } from '@emotion/css';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

const PICKER_COMPONENT_ID = 'grafana-assistant-app/context-picker/v0';

/** Props contract of the assistant plugin's exposed context picker component. */
interface AssistantContextPickerProps {
  label?: string;
  selectedIds?: string[];
  onSelect?: (item: ChatContextItem) => void;
  disabled?: boolean;
}

interface Props {
  items: ChatContextItem[];
  onAdd: (item: ChatContextItem) => void;
  onRemove: (item: ChatContextItem) => void;
  disabled?: boolean;
}

/**
 * The assistant chat's "add context" tree (datasources, metrics, labels,
 * dashboards, …) embedded in the wizard, so the user can point the build at
 * specific things instead of describing them. Rendered through the assistant
 * plugin's exposed picker component; when the plugin (or the exposed
 * component) is absent, the whole row disappears — attaching context is a
 * bonus, not a requirement.
 */
export function WizardContextPicker({ items, onAdd, onRemove, disabled }: Props) {
  const styles = useStyles2(getStyles);
  const { component: Picker, isLoading } = usePluginComponent<AssistantContextPickerProps>(PICKER_COMPONENT_ID);

  if (isLoading || !Picker) {
    return null;
  }

  return (
    <div className={styles.row}>
      {items.map((item) => (
        <span key={item.node.id} className={styles.chip}>
          <span className={styles.chipLabel}>{item.node.name}</span>
          <IconButton
            name="times"
            size="sm"
            tooltip={t('dashboard-wizard.context-picker.remove', 'Remove {{name}}', { name: item.node.name })}
            onClick={() => onRemove(item)}
            disabled={disabled}
          />
        </span>
      ))}
      <Picker
        label={t('dashboard-wizard.context-picker.add', 'Add context')}
        selectedIds={items.map((item) => item.node.id)}
        onSelect={onAdd}
        disabled={disabled}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    chip: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      maxWidth: '260px',
      padding: theme.spacing(0.25, 0.5, 0.25, 1),
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.medium}`,
      background: theme.colors.background.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    chipLabel: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
