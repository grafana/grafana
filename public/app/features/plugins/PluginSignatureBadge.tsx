import React from 'react';
import { Icon, stylesFactory, useTheme, IconName } from '@grafana/ui';
import { GrafanaTheme, PluginSignatureStatus } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  status: PluginSignatureStatus;
}

export const PluginSignatureBadge: React.FC<Props> = ({ status }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const display = getSignatureDisplayModel(status);

  return (
    <div className={styles.wrapper}>
      <Icon name={display.icon} size="sm" />
      <span>{display.text}</span>
    </div>
  );
};

function getSignatureDisplayModel(signature: PluginSignatureStatus): { text: string; icon: IconName } {
  switch (signature) {
    case PluginSignatureStatus.internal:
      return { text: 'Core', icon: 'lock' };
  }

  return { text: 'Unsigned', icon: 'unlock' };
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      font-size: ${theme.typography.size.sm};
      display: inline-flex;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 6px;
      color: ${theme.colors.textWeak};

      > span {
        position: relative;
        top: 1px;
        margin-left: 2px;
      }
    `,
  };
});

PluginSignatureBadge.displayName = 'PluginSignatureBadge';
