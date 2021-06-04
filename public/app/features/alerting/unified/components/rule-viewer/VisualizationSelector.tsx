import React, { useCallback, useMemo, useState } from 'react';
import { ClickOutsideWrapper, IconButton, Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { SupportedPanelPlugins } from '../rule-editor/QueryWrapper';
import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from '@grafana/runtime';
import { STAT, TABLE, TIMESERIES } from '../../utils/constants';

type VisualizationSelectorProps = {
  value: SupportedPanelPlugins | undefined;
  onSelect: (value: SupportedPanelPlugins) => void;
};

export function VisualizationSelector(props: VisualizationSelectorProps) {
  const { value, onSelect } = props;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const options = useMemo(() => getSupportedPanels(), []);
  const styles = useStyles2(getStyles);

  const onOpen = useCallback(
    (event: React.MouseEvent) => {
      event?.stopPropagation();
      setIsOpen(!isOpen);
    },
    [isOpen]
  );

  return (
    <div className={styles.container}>
      <IconButton name="graph-bar" size="sm" onClick={onOpen} title="Change visualization" />
      {isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper onClick={() => setIsOpen(false)} parent={document}>
            <Menu>
              {options.map((item) => (
                <MenuItem
                  key={item.value}
                  label={item.label || item.value}
                  ariaLabel={item.label || item.value}
                  onClick={() => {
                    setIsOpen(false);
                    onSelect(item.value as SupportedPanelPlugins);
                  }}
                  active={item.value === value}
                  imgSrc={item.imgUrl}
                />
              ))}
            </Menu>
          </ClickOutsideWrapper>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuWrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      top: ${theme.spacing(4)};
      right: 0;
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius(1)};
    `,
    container: css`
      padding-left: ${theme.spacing(0.75)};
    `,
  };
};

function isSupportedPanel(meta: PanelPluginMeta): boolean {
  switch (meta.id) {
    case TIMESERIES:
    case TABLE:
    case STAT:
      return true;

    default:
      return false;
  }
}

const getSupportedPanels = () => {
  return Object.values(config.panels)
    .filter(isSupportedPanel)
    .map((panel) => ({ value: panel.id, label: panel.name, imgUrl: panel.info.logos.small }));
};
