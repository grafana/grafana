import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Drawer, IconButton, useStyles2 } from '@grafana/ui';
import { getCircularReplacer } from 'app/core/utils/object';

import { DrawerDropZone } from './DrawerDropZone';

type DrawerSize = 'sm' | 'md' | 'lg';

export interface Props {
  open: boolean;
  onClose: () => void;
  selectedTab?: string;
  onChangeTab: (id?: string) => void;
}

function ExampleTab() {
  const [data, setData] = useState<string | null>(null);

  return (
    <div>
      <p>Example content from a plugin</p>
      <DrawerDropZone onDrop={setData}>
        {data ? JSON.stringify(data, getCircularReplacer()) : <h2>Drop something here</h2>}
      </DrawerDropZone>
    </div>
  );
}

export function ExtensionDrawer({ open, onClose, selectedTab }: Props) {
  const styles = useStyles2(getStyles);
  const [size, setSize] = useState<DrawerSize>('md');
  const extensions = useMemo(() => {
    const extensionPointId = PluginExtensionPoints.GlobalDrawer;
    const { extensions } = getPluginComponentExtensions({ extensionPointId });
    return extensions;
  }, []);

  console.log(extensions);

  const activeTab = selectedTab ?? extensions[0]?.id;

  const children = useMemo(
    () =>
      extensions.map(
        (extension, index) =>
          activeTab === extension.id && (
            // Support lazy components with a fallback.
            <Suspense key={index} fallback={'Loading...'}>
              <extension.component />
            </Suspense>
          )
      ),
    [activeTab, extensions]
  );

  const [buttonIcon, buttonLabel, newSize] =
    size === 'lg'
      ? (['gf-movepane-left', 'Narrow drawer', 'md'] as const)
      : (['gf-movepane-right', 'Widen drawer', 'lg'] as const);

  return (
    open && (
      <Drawer
        onClose={onClose}
        title=""
        subtitle={
          <div className={styles.wrapper}>
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
