import html2canvas from 'html2canvas';
import { useState } from 'react';

import { config, getBackendSrv } from '@grafana/runtime';
import { Menu, Dropdown, ToolbarButton, Button, Stack } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { canvasToBase64String, extractImageTypeAndData } from '../../../../features/feedback/screenshot-encode';

export interface Props {}

export const ReportIssueButton = ({}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const MenuActions = () => {
    const onClick = async (e: { preventDefault: () => void }) => {
      e.preventDefault();
      console.log('hi', e);

      let screenshot = null;

      console.log('CONFIG', config);

      const element = document.body; // TODO: choose a different selector?
      if (element) {
        const canvas = await html2canvas(element, { backgroundColor: null });

        const encoded = await canvasToBase64String(canvas);
        if (encoded && typeof encoded === 'string') {
          screenshot = extractImageTypeAndData(encoded);
        }
      }

      const externallyInstalledPlugins = await getBackendSrv().get('/api/plugins', { embedded: 0, core: 0, enabled: 1 });

      console.log('PLUGINS', externallyInstalledPlugins);

      const feedback: Spec = {
        message: 'test sarah test',
        diagnosticData: {
          instance: {
            version: config?.buildInfo?.versionString,
            edition: config?.licenseInfo?.edition,
            apps: Object.keys(config?.apps),
            database: {
              sqlConnectionLimits: config?.sqlConnectionLimits,
            },
            externallyInstalledPlugins: externallyInstalledPlugins.map((plugin: { name: string; info: { version: string; updated: string; }; }) => ({
              name: plugin.name,
              version: plugin.info.version,
              buildDate: plugin.info.updated,
            })),
            featureToggles: config?.featureToggles,
            rbacEnabled: config.rbacEnabled,
            samlEnabled: config.samlEnabled,
            imageRendererAvailable: config.rendererAvailable,
            datasources: Object.values(config?.datasources).map(settings => ({
              name: settings.meta.name,
              type: settings.type,
              ...(settings?.meta?.info?.version && { version: settings?.meta?.info?.version }),
            })),
            panels: Object.keys(config.panels),
          },
          browser: {
            userAgent: navigator?.userAgent,
            cookiesEnabled: navigator?.cookieEnabled,
            hasTouchScreen: navigator?.maxTouchPoints > 0,
          },
        },
        ...(screenshot && { screenshot: screenshot.data, imageType: screenshot.type }),
      };

      const feedbackApi = getFeedbackAPI();
      await feedbackApi.createFeedback(feedback);
    };

    return (
      <Menu>
          <b>Send feedback to Grafana</b>
          <Stack gap={2} direction={'column'}>
            <input placeholder="so what happened?"></input>
            <Button type="submit" onClick={onClick}>Submit feedback</Button>
          </Stack>
      </Menu>
    );
  };

  return (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton iconOnly icon={'bug'} isOpen={isOpen} aria-label="New" />
      </Dropdown>
    </>
  );
};
