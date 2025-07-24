import { PluginState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, BadgeProps } from '@grafana/ui';

interface Props {
  state?: PluginState;
  className?: string;
}

export const PluginStateInfo = (props: Props) => {
  const display = getFeatureStateInfo(props.state);

  if (!display) {
    return null;
  }

  return (
    <Badge
      className={props.className}
      color={display.color}
      title={typeof display.tooltip === 'string' ? display.tooltip : undefined}
      tooltip={typeof display.tooltip !== 'string' ? display.tooltip : undefined}
      text={display.text}
      icon={display.icon}
    />
  );
};

function getFeatureStateInfo(state?: PluginState): BadgeProps | null {
  switch (state) {
    case PluginState.deprecated:
      return {
        text: t('plugins.get-feature-state-info.text.deprecated', 'Deprecated'),
        color: 'red',
        tooltip: `This feature is deprecated and will be removed in a future release`,
      };
    case PluginState.alpha:
      return {
        text: t('plugins.get-feature-state-info.text.alpha', 'Alpha'),
        color: 'blue',
        tooltip: `This feature is experimental and future updates might not be backward compatible`,
      };
    case PluginState.beta:
      return {
        text: t('plugins.get-feature-state-info.text.beta', 'Beta'),
        color: 'blue',
        tooltip: `This feature is close to complete but not fully tested`,
      };
    default:
      return null;
  }
}
