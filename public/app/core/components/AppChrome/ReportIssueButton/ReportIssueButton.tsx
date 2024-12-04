import html2canvas from 'html2canvas';
import { useState } from 'react';

import { Menu, Dropdown, ToolbarButton, Button, Stack } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { canvasToBase64String } from '../../../../features/feedback/screenshot-encode';

export interface Props {}

export const ReportIssueButton = ({}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const MenuActions = () => {
    const onClick = async (e: { preventDefault: () => void }) => {
      e.preventDefault();
      console.log('hi', e);

      let screenshot = undefined;

      const element = document.body; // TODO: choose a different selector?
      if (element) {
        const canvas = await html2canvas(element, { backgroundColor: null });

        const encoded = await canvasToBase64String(canvas);
        if (encoded && typeof encoded === 'string') {
          screenshot = encoded;
        }
      }

      // TODO: we should filter this in the backend!
      screenshot = screenshot?.replace('data:image/png;base64,', '');

      const feedback: Spec = {
        message: 'test sarah test',
        ...(screenshot && { screenshot }),
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
