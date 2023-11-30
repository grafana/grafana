import React, { useMemo } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Drawer, Tab, TabsBar } from '@grafana/ui';

export interface Props {
  open: boolean;
  onClose: () => void;
  activeTab?: string;
  onChangeTab: (id?: string) => void;
}

function ExampleTab() {
  return <div>Example content from a plugin</div>;
}

export function ExtensionDrawer({ open, onClose, activeTab, onChangeTab }: Props) {
  const extensions = useMemo(() => {
    const extensionPointId = PluginExtensionPoints.GlobalDrawer;
    const { extensions } = getPluginComponentExtensions({ extensionPointId });
    return extensions;
  }, []);

  const tabs = useMemo(() => {
    return (
      <TabsBar>
        {activeTab === undefined && <Tab label="Example" active={true} onChangeTab={() => onChangeTab(undefined)} />}
        {extensions.map((extension, index) => (
          <Tab
            key={index}
            label={extension.title}
            active={activeTab === extension.id || (!activeTab && index === 0)}
            onChangeTab={() => onChangeTab(extension.id)}
          />
        ))}
      </TabsBar>
    );
  }, [activeTab, extensions, onChangeTab]);

  const children = useMemo(
    () => extensions.map((extension, index) => activeTab === extension.id && <extension.component key={index} />),
    [activeTab, extensions]
  );

  return (
    open && (
      <Drawer
        tabs={tabs}
        onClose={onClose}
        title="Extensions"
        subtitle={
          <div>
            <div>Plugins can add tabs to this drawer to present globally accessible content.</div>
            <div>
              Tip: open this drawer from anywhere using your keyboard with <code>g i</code>.
            </div>
          </div>
        }
        size="md"
        closeOnMaskClick={false}
      >
        {activeTab === undefined && <ExampleTab />}
        {children}
      </Drawer>
    )
  );
}
