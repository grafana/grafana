import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { GrafanaThemeV2 } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { DropdownMenu } from './DropdownMenu';

/**
 * @internal
 */
export interface Props {}

/**
 * @internal
 */
export const PanelChromeMenu: React.FC<Props> = ({}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.bubbleMenu + ' panel-chrome-bubble-menu'}>
      <Tooltip content="View panel" placement="top">
        <div className={styles.bubbleMenuItem}>
          <Icon name="eye" className="panel-chrome-bubble-menu-icon" />
        </div>
      </Tooltip>
      <Tooltip content="Edit panel" placement="top">
        <div className={styles.bubbleMenuItem}>
          <Icon name="pen" className="panel-chrome-bubble-menu-icon" />
        </div>
      </Tooltip>
      <Tooltip content="Share panel" placement="top">
        <div className={styles.bubbleMenuItem}>
          <Icon name="share-alt" className="panel-chrome-bubble-menu-icon" />
        </div>
      </Tooltip>
      <DropdownMenu className={styles.bubbleMenuItem} />
    </div>
  );
};

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    bubbleMenu: css`
      position: absolute;
      right: 0;
      top: ${theme.spacing(-4)};
      box-shadow: ${theme.shadows.z2};
      display: flex;
      align-items: center;
      padding: 1px solid;
      border-radius: ${theme.shape.borderRadius()};
      background: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.weak};
      box-shadow: ${theme.shadows.z2};
      opacity: 0;
      transition: ${theme.transitions.create('opacity', {
        duration: theme.transitions.duration.standard,
      })};
    `,
    bubbleMenuItem: css`
      display: flex;
      align-items: center;
      height: ${theme.spacing(4)};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(1)};

      &:hover {
        background: ${theme.colors.background.secondary};

        .panel-chrome-bubble-menu-icon {
          color: ${theme.colors.text.primary};
        }
      }

      .panel-chrome-bubble-menu-icon {
        color: ${theme.colors.text.secondary};
      }
    `,
  };
};
