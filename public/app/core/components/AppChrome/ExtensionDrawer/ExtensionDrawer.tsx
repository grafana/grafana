import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Drawer, IconButton, Tab, TabsBar, useStyles2 } from '@grafana/ui';

type DrawerSize = 'sm' | 'md' | 'lg';

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedTab?: string;
  onChangeTab: (id?: string) => void;
}

function ExampleTab() {
  return <div>Example content from a plugin</div>;
}

export function ExtensionDrawer({ open, onClose, selectedTab, onChangeTab }: Props) {
  const styles = useStyles2(getStyles);
  const [size, setSize] = useState<DrawerSize>('md');
  const extensions = useMemo(() => {
    const extensionPointId = PluginExtensionPoints.GlobalDrawer;
    const { extensions } = getPluginComponentExtensions({ extensionPointId });
    return extensions;
  }, []);

  const activeTab = selectedTab ?? extensions[0]?.id;

  const tabs = useMemo(() => {
    return (
      <TabsBar>
        {extensions.map((extension, index) => (
          <Tab
            key={index}
            label={extension.title}
            active={activeTab === extension.id}
            onChangeTab={() => onChangeTab(extension.id)}
          />
        ))}
        {extensions.length === 0 && <Tab label="Example" active={true} onChangeTab={() => onChangeTab(undefined)} />}
      </TabsBar>
    );
  }, [activeTab, extensions, onChangeTab]);

  const children = useMemo(
    () => extensions.map((extension, index) => activeTab === extension.id && <extension.component key={index} />),
    [activeTab, extensions]
  );

  const [buttonIcon, buttonLabel, newSize] =
    size === 'lg'
      ? (['gf-movepane-left', 'Narrow drawer', 'md'] as const)
      : (['gf-movepane-right', 'Widen drawer', 'lg'] as const);

  return (
    open && (
      <Drawer
        tabs={tabs}
        onClose={onClose}
        title="Extensions"
        subtitle={
          <div className={styles.wrapper}>
            <div>
              <div>Plugins can add tabs to this drawer to present globally accessible content.</div>
              <div>
                Tip: open this drawer from anywhere using your keyboard with <code>g i</code>.
              </div>
            </div>
            <IconButton
              name={buttonIcon}
              aria-label={buttonLabel}
              tooltip={buttonLabel}
              onClick={() => setSize(newSize)}
            />
          </div>
        }
        size={size}
        closeOnMaskClick={false}
      >
        {children}
        {activeTab === undefined && <ExampleTab />}
      </Drawer>
    )
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  }),
});
