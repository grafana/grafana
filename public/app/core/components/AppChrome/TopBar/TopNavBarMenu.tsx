import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { getAppEvents, OpenKeyboardShortcutsModalEvent } from '@grafana/runtime';
import { Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { ShowModalReactEvent } from 'app/types/events';

import { HelpModal } from '../../help/HelpModal';
import { enrichWithInteractionTracking } from '../MegaMenu/utils';

export interface TopNavBarMenuProps {
  node: NavModelItem;
  children?: React.ReactNode;
}

export function TopNavBarMenu({ node: nodePlain, children }: TopNavBarMenuProps) {
  const styles = useStyles2(getStyles);
  const node = enrichWithInteractionTracking(cloneDeep(nodePlain), false);
  const appEvents = getAppEvents();
  // Subscribe to separate shortcuts events so that plugins and other places can
  // open the keyboard shortcuts modal, without having to have access to the necessary components
  appEvents.subscribe(OpenKeyboardShortcutsModalEvent, () => {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  });

  if (!node) {
    return null;
  }

  return (
    <Menu
      header={
        // this is needed to prevent bubbling the event to `Menu` and then closing when highlighting header text
        // see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={(e) => e.stopPropagation()} className={styles.header}>
          <div>{node.text}</div>
          {node.subTitle && <div className={styles.subTitle}>{node.subTitle}</div>}
        </div>
      }
    >
      {node.children?.map((item) => {
        return item.url ? (
          <MenuItem url={item.url} label={item.text} icon={item.icon} target={item.target} key={item.id} />
        ) : (
          <MenuItem icon={item.icon} onClick={item.onClick} label={item.text} key={item.id} />
        );
      })}
      {children}
    </Menu>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.h5.fontWeight,
      padding: theme.spacing(0.5, 1),
      whiteSpace: 'nowrap',
    }),
    subTitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
