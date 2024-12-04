import html2canvas from 'html2canvas';
import { useState } from 'react';

import { Menu, Dropdown, ToolbarButton, Button, Stack } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { canvasToBase64String, extractImageTypeAndData } from '../../../../features/feedback/screenshot-encode';

export interface Props {}

const MenuActions = () => {
  const [formData, setFormData] = useState({ message: '' });
  const onClick = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    let screenshot = null;

    const element = document.body; // TODO: choose a different selector?
    if (element) {
      const canvas = await html2canvas(element, { backgroundColor: null });

      const encoded = await canvasToBase64String(canvas);
      if (encoded && typeof encoded === 'string') {
        screenshot = extractImageTypeAndData(encoded);
      }
    }

    const feedback: Spec = {
      message: formData.message,
      ...(screenshot && { screenshot: screenshot.data, imageType: screenshot.type }),
    };

    const feedbackApi = getFeedbackAPI();
    await feedbackApi.createFeedback(feedback);
  };

  return (
    <Menu>
      <b>Send feedback to Grafana</b>

      <Stack gap={2} direction={'column'}>
        <input
          value={formData.message}
          onChange={(e) => setFormData({ message: e.target.value })}
          placeholder="so what happened?"
        ></input>
        <Button type="submit" onClick={onClick}>
          Submit feedback
        </Button>
      </Stack>
    </Menu>
  );
};

export const ReportIssueButton = ({}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Dropdown overlay={<MenuActions />} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton iconOnly icon={'bug'} isOpen={isOpen} aria-label="New" />
      </Dropdown>
    </>
  );
};

/* 
  TODO:
  - put this behind a feature flag
  - screenshot should be behind a button
  - see if we can get annotations to work
*/
