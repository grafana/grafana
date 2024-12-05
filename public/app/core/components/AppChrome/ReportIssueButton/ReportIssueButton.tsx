import html2canvas from 'html2canvas';
import { ChangeEvent, MouseEvent, useState } from 'react';

import { Dropdown, ToolbarButton, Button, Stack, Menu } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { canvasToBase64String, extractImageTypeAndData } from '../../../../features/feedback/screenshot-encode';

export interface Props { }

const MenuActions = () => {
  const [formData, setFormData] = useState({ message: '', screenshot: '', imageType: '' });

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({ ...formData, message: e.target.value });
  };

  const onTakeScreenshot = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const element = document.body; // TODO: choose a different selector?
    if (element) {
      const canvas = await html2canvas(element, { backgroundColor: null });

      const encoded = await canvasToBase64String(canvas);
      if (encoded && typeof encoded === 'string') {
        const screenshot = extractImageTypeAndData(encoded);
        if (screenshot) {
          setFormData({ ...formData, screenshot: screenshot.data, imageType: screenshot.type });
        }
      }
    }
  };

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    const feedback: Spec = {
      message: formData.message,
      screenshot: formData.screenshot,
      imageType: formData.imageType,
    };

    const feedbackApi = getFeedbackAPI();
    await feedbackApi.createFeedback(feedback);
  };

  const stopAutoClose = (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <Menu>
      <div onClick={stopAutoClose}>
        <b>Send feedback to Grafana</b>

        <Stack gap={2} direction={'column'}>
          <input onChange={onInputChange} placeholder="so what happened?"></input>
          <Button onClick={onTakeScreenshot}>Take Screenshot</Button>
          <Button type="submit" onClick={onSubmit}>
            Submit feedback
          </Button>
        </Stack>
      </div>
    </Menu>

  );
};

export const ReportIssueButton = ({ }: Props) => {
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
  - see if we can get annotations to work
  - make it stylistically pretty
*/
