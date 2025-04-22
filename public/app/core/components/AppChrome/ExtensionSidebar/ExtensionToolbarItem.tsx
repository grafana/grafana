import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Menu, ToolbarButton, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';

export function ExtensionToolbarItem() {
  const styles = getStyles(useTheme2());
  const { availableComponents, dockedComponentId, setDockedComponentId, isOpen, isEnabled } =
    useExtensionSidebarContext();

  let dockedComponentTitle = '';
  if (dockedComponentId) {
    const dockedComponent = getComponentMetaFromComponentId(dockedComponentId);
    if (dockedComponent) {
      dockedComponentTitle = dockedComponent.componentTitle;
    }
  }

  if (!isEnabled || availableComponents.size === 0) {
    return null;
  }

  // get a flat list of all components with their pluginId
  const components = Array.from(availableComponents.entries()).flatMap(([pluginId, { addedComponents }]) =>
    addedComponents.map((c) => ({ ...c, pluginId }))
  );

  if (components.length === 0) {
    return null;
  }

  // conditionally renders a button to open or close the sidebar
  // not using a component to avoid passing refs with the `Dropdown` component
  const renderButton = useCallback(
    (isOpen: boolean, title?: string, onClick?: () => void) => {
      if (isOpen) {
        // render button to close the sidebar
        return (
          <ToolbarButton
            className={cx(styles.button, styles.buttonActive)}
            icon="ai-sparkle"
            data-testid="extension-toolbar-button-close"
            variant="default"
            onClick={() => setDockedComponentId(undefined)}
            tooltip={t('navigation.extension-sidebar.button-tooltip.close', 'Close {{title}}', { title })}
          />
        );
      }
      // if a title is provided, use it in the tooltip
      let tooltip = t('navigation.extension-sidebar.button-tooltip.open-all', 'Open AI assistants and sidebar apps');
      if (title) {
        tooltip = t('navigation.extension-sidebar.button-tooltip.open', 'Open {{title}}', { title });
      }
      return (
        <ToolbarButton
          className={cx(styles.button)}
          icon="ai-sparkle"
          data-testid="extension-toolbar-button-open"
          variant="default"
          onClick={onClick}
          tooltip={tooltip}
        />
      );
    },
    [setDockedComponentId, styles.button, styles.buttonActive]
  );

  if (components.length === 1) {
    return (
      <>
        {renderButton(isOpen, components[0].title, () => {
          if (isOpen) {
            setDockedComponentId(undefined);
          } else {
            setDockedComponentId(getComponentIdFromComponentMeta(components[0].pluginId, components[0]));
          }
        })}
        <NavToolbarSeparator />
      </>
    );
  }

  const MenuItems = (
    <Menu>
      {components.map((c) => {
        const id = getComponentIdFromComponentMeta(c.pluginId, c);
        return (
          <Menu.Item
            key={id}
            active={dockedComponentId === id}
            label={c.title}
            onClick={() => {
              if (isOpen && dockedComponentId === id) {
                setDockedComponentId(undefined);
              } else {
                setDockedComponentId(id);
              }
            }}
          />
        );
      })}
    </Menu>
  );
  return (
    <>
      {isOpen &&
        renderButton(isOpen, dockedComponentTitle, () => {
          if (isOpen) {
            setDockedComponentId(undefined);
          }
        })}
      {!isOpen && (
        <Dropdown overlay={MenuItems} placement="bottom-end">
          {renderButton(isOpen)}
        </Dropdown>
      )}
      <NavToolbarSeparator />
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      // this is needed because with certain breakpoints the button will get `width: auto`
      // and the icon will stretch
      aspectRatio: '1 / 1 !important',
      width: '28px',
      height: '28px',
      padding: 0,
      justifyContent: 'center',
      borderRadius: theme.shape.radius.circle,
      margin: theme.spacing(0, 0.25),
    }),
    buttonActive: css({
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.primary.transparent,
      border: `1px solid ${theme.colors.primary.borderTransparent}`,
      color: theme.colors.text.primary,
    }),
  };
}
