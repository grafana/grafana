import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Menu, ToolbarButton, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { getComponentIdFromComponentMeta, useExtensionSidebarContext } from './ExtensionSidebarProvider';

export function ExtensionToolbarItem() {
  const styles = getStyles(useTheme2());
  const { availableComponents, dockedComponentId, setDockedComponentId, isOpen, isEnabled } =
    useExtensionSidebarContext();

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

  if (components.length === 1) {
    return (
      <>
        <ToolbarButton
          icon="ai-sparkle"
          data-testid="extension-toolbar-button"
          className={cx(styles.button, isOpen && styles.buttonActive)}
          tooltip={components[0].description}
          onClick={() => {
            if (isOpen) {
              setDockedComponentId(undefined);
            } else {
              setDockedComponentId(getComponentIdFromComponentMeta(components[0].pluginId, components[0]));
            }
          }}
        />
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
      <Dropdown overlay={MenuItems} placement="bottom-end">
        <ToolbarButton
          className={cx(styles.button, isOpen && styles.buttonActive)}
          icon="ai-sparkle"
          data-testid="extension-toolbar-button"
          variant="default"
          tooltip={t('navigation.extension-sidebar.button-tooltip', 'Open AI assistants and sidebar apps')}
        />
      </Dropdown>
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
