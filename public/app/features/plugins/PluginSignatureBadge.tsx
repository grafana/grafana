import React from 'react';
import { Icon, IconName, stylesFactory, Tooltip, useTheme } from '@grafana/ui';
import {
  getColorFromHexRgbOrName,
  GrafanaTheme,
  PanelPluginMeta,
  PluginSignatureStatus,
  PluginState,
} from '@grafana/data';
import { css } from 'emotion';
import tinycolor from 'tinycolor2';

interface Props {
  status: PluginSignatureStatus;
}

export const PluginSignatureBadge: React.FC<Props> = ({ status }) => {
  const theme = useTheme();
  const display = getSignatureDisplayModel(status);
  const styles = getStyles(theme, display);

  return (
    <Tooltip content={display.tooltip} placement="left">
      <div className={styles.wrapper}>
        <Icon name={display.icon} size="sm" />
        <span>{display.text}</span>
      </div>
    </Tooltip>
  );
};

interface PanelPluginBadgeProps {
  plugin: PanelPluginMeta;
}
export const PanelPluginBadge: React.FC<PanelPluginBadgeProps> = ({ plugin }) => {
  const theme = useTheme();
  const display = getPanelStateBadgeDisplayModel(plugin);
  const styles = getStyles(theme, display);

  if (plugin.state !== PluginState.deprecated && plugin.state !== PluginState.alpha) {
    return null;
  }
  return (
    <div className={styles.wrapper}>
      <Icon name={display.icon} size="sm" />
      <span>{display.text}</span>
    </div>
  );
};

interface DisplayModel {
  text: string;
  icon: IconName;
  color: string;
  tooltip: string;
}

function getSignatureDisplayModel(signature: PluginSignatureStatus): DisplayModel {
  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', icon: 'cube', color: 'blue', tooltip: 'Core plugin that is bundled with Grafana' };
    case PluginSignatureStatus.valid:
      return { text: 'Signed', icon: 'lock', color: 'green', tooltip: 'Signed and verified plugin' };
    case PluginSignatureStatus.invalid:
      return {
        text: 'Invalid',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Invalid plugin signature',
      };
    case PluginSignatureStatus.modified:
      return {
        text: 'Modified',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: 'Valid signature but content has been modified',
      };
  }

  return { text: 'Unsigned', icon: 'exclamation-triangle', color: 'red', tooltip: 'Unsigned external plugin' };
}

function getPanelStateBadgeDisplayModel(panel: PanelPluginMeta): DisplayModel {
  switch (panel.state) {
    case PluginState.deprecated:
      return {
        text: 'Deprecated',
        icon: 'exclamation-triangle',
        color: 'red',
        tooltip: `${panel.name} panel is deprecated`,
      };
  }

  return {
    text: 'Alpha',
    icon: 'rocket',
    color: 'blue',
    tooltip: `${panel.name} panel is experimental`,
  };
}

const getStyles = stylesFactory((theme: GrafanaTheme, model: DisplayModel) => {
  let sourceColor = getColorFromHexRgbOrName(model.color);
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (theme.isDark) {
    bgColor = tinycolor(sourceColor)
      .darken(38)
      .toString();
    borderColor = tinycolor(sourceColor)
      .darken(25)
      .toString();
    textColor = tinycolor(sourceColor)
      .lighten(45)
      .toString();
  } else {
    bgColor = tinycolor(sourceColor)
      .lighten(30)
      .toString();
    borderColor = tinycolor(sourceColor)
      .lighten(15)
      .toString();
    textColor = tinycolor(sourceColor)
      .darken(40)
      .toString();
  }

  return {
    wrapper: css`
      font-size: ${theme.typography.size.sm};
      display: inline-flex;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 6px;
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};

      > span {
        position: relative;
        top: 1px;
        margin-left: 2px;
      }
    `,
  };
});

PluginSignatureBadge.displayName = 'PluginSignatureBadge';
