import React from 'react';
import { GrafanaTheme, PanelPluginMeta, PluginState } from '@grafana/data';
import { styleMixins, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { PanelPluginBadge } from '../../plugins/PluginSignatureBadge';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  onClick: () => void;
  disabled: boolean;
}

const VizTypePickerPlugin: React.FC<Props> = ({ isCurrent, plugin, onClick, disabled }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const cssClass = cx({
    [styles.item]: true,
    [styles.disabled]: disabled || plugin.state === PluginState.deprecated,
    [styles.current]: isCurrent,
  });

  return (
    <div className={styles.wrapper} aria-label={selectors.components.PluginVisualization.item(plugin.name)}>
      <div className={cssClass} onClick={disabled ? () => {} : onClick} title={plugin.name}>
        <div className={styles.bg} />
        <div className={styles.itemContent}>
          <div className={styles.name} title={plugin.name}>
            {plugin.name}
          </div>
          <img className={styles.img} src={plugin.info.logos.small} />
        </div>
      </div>
      <div className={cx(styles.badge, disabled && styles.disabled)}>
        <PanelPluginBadge plugin={plugin} />
      </div>
    </div>
  );
};

VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      position: relative;
    `,
    bg: css`
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${theme.colors.bg2};
      border: 1px solid ${theme.colors.border2};
      border-radius: 3px;
      transform: scale(1);
      transform-origin: center;
      transition: all 0.1s ease-in;
      z-index: 0;
    `,
    item: css`
      flex-shrink: 0;
      flex-direction: column;
      text-align: center;
      cursor: pointer;
      display: flex;
      margin-right: 10px;
      align-items: center;
      justify-content: center;
      padding-bottom: 6px;
      height: 100px;
      width: 100%;
      position: relative;

      &:hover {
        > div:first-child {
          transform: scale(1.05);
          border-color: ${theme.colors.formFocusOutline};
        }
      }
    `,
    itemContent: css`
      position: relative;
      z-index: 1;
      width: 100%;
    `,
    current: css`
      label: currentVisualizationItem;
      pointer-events: none;
      > div:first-child {
        ${styleMixins.focusCss(theme)};
      }
    `,
    disabled: css`
      opacity: 0.2;
      filter: grayscale(1);
      cursor: default;
      pointer-events: none;
      &:hover {
        border: 1px solid ${theme.colors.border2};
      }
    `,
    name: css`
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      font-size: ${theme.typography.size.sm};
      text-align: center;
      height: 23px;
      font-weight: ${theme.typography.weight.semibold};
      padding: 0 10px;
      width: 100%;
    `,
    img: css`
      height: 55px;
    `,
    badge: css`
      position: absolute;
      bottom: ${theme.spacing.xs};
      right: ${theme.spacing.xs};
      z-index: 1;
    `,
  };
});

export default VizTypePickerPlugin;
