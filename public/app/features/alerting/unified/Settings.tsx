import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Drawer, Stack, Text, useStyles2 } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import InternalAlertmanager from './components/admin/InternalAlertmanager';

// @todo translate subtitle – move to navtree?
const SUBTITLE =
  'Manage Alertmanger configurations and configure where alert instances generated from Grafana-managed alert rules are sent.';

export default function SettingsPage() {
  const [configurationDrawer, showConfiguration] = useEditConfigurationDrawer();

  return (
    <AlertingPageWrapper navId="alerting-admin" subTitle={SUBTITLE}>
      <Stack direction="column" gap={3}>
        {/* internal Alertmanager */}
        <Text variant="h5">Built-in Alertmanager</Text>
        <InternalAlertmanager onEditConfiguration={showConfiguration} />
        {/* external Alertmanagers (data sources) we have added to Grafana (vanilla, Mimir, Cortex) */}
        <Text variant="h5">Other Alertmanagers</Text>
        <ExternalAlertmanagers onEditConfiguration={showConfiguration} />
      </Stack>
      {configurationDrawer}
    </AlertingPageWrapper>
  );
}

// @TODO move to another file
function useEditConfigurationDrawer(): [React.ReactNode, () => void, () => void] {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(false);

  const showConfiguration = useCallback(() => {
    setOpen(true);
  }, []);

  const dismissConfiguration = useCallback(() => {
    setOpen(false);
  }, []);

  const drawer = useMemo(() => {
    if (!open) {
      return null;
    }

    // @todo check copy
    return (
      <Drawer
        onClose={dismissConfiguration}
        title="Alertmanager name here"
        subtitle="This is the Alertmanager configuration"
        size="md"
      >
        <div className={styles.container}>
          <div className={styles.content}>
            <AutoSizer disableWidth>
              {({ height }) => (
                <CodeEditor
                  width="100%"
                  height={height}
                  language={'json'}
                  value={'hello world'}
                  monacoOptions={{
                    minimap: {
                      enabled: false,
                    },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                  }}
                />
              )}
            </AutoSizer>
          </div>
          <Stack justifyContent="flex-end">
            <Button variant="secondary" onClick={dismissConfiguration}>
              Cancel
            </Button>
            <Button variant="primary">Save</Button>
          </Stack>
        </div>
      </Drawer>
    );
  }, [dismissConfiguration, open, styles.container, styles.content]);

  return [drawer, showConfiguration, dismissConfiguration];
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: theme.spacing(2),
  }),
  content: css({
    flex: '1 1 100%',
  }),
});
