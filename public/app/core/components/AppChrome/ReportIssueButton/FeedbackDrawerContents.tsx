import { ChangeEvent, useRef, MouseEvent, useEffect } from 'react';

import { Button, InlineSwitch, Stack, TextArea, Field, Input } from '@grafana/ui';
import { getFeedbackAPI } from 'app/features/feedback/api';
import { getDiagnosticData } from 'app/features/feedback/diagnostic-data';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';

import { FeedbackFormData } from './types';
import { isCanvas } from './utils';

type DrawerContentsProps = {
  setIsOpen: (isOpen: boolean) => void;
  setFormData: (fd: FeedbackFormData) => void;
  setIsScreenshotEditModalOpen: (isOpen: boolean) => void;
  feedbackPlus: any;
  formData: FeedbackFormData;
};

export const DrawerContents = ({
  setIsOpen,
  setFormData,
  feedbackPlus,
  formData,
  setIsScreenshotEditModalOpen,
}: DrawerContentsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({ ...formData, message: e.target.value });
  };

  const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({ ...formData, reporterEmail: e.target.value });
  };

  const onTakeScreenshot = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    feedbackPlus
      .capture()
      .then(({ bitmap, width, height }: { bitmap: HTMLImageElement; width: number; height: number }) => {
        setFormData({ ...formData, bitmap, width, height });
        setIsScreenshotEditModalOpen(true);
      });
  };

  const onAccessChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, accessChecked: e.target.checked });
  };
  const onContactChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, contactChecked: e.target.checked });
  };

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    const diagnosticData = await getDiagnosticData();

    const feedback: Spec = {
      message: formData.message,
      screenshot: formData.screenshot,
      imageType: formData.imageType,
      diagnosticData,
      canContactReporter: formData.contactChecked,
      canAccessInstance: formData.accessChecked,
      reporterEmail: formData.reporterEmail,
    };

    const feedbackApi = getFeedbackAPI();
    await feedbackApi.createFeedback(feedback);
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas && isCanvas(canvas) && formData.screenshot) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const fixedWidth = 200;
        const aspectRatio = formData.height / formData.width;
        const proportionalHeight = fixedWidth * aspectRatio;
        canvas.width = fixedWidth;
        canvas.height = proportionalHeight;

        const image = new Image();
        image.onload = function () {
          ctx.drawImage(image, 0, 0, fixedWidth, proportionalHeight);
        };
        image.src = 'data:image/' + formData.imageType + ';base64,' + formData.screenshot;
      }
    }
  }, [formData.height, formData.imageType, formData.screenshot, formData.width]);

  return (
    <Stack direction={'column'}>
      <Field label="Tell us what happened: ">
        <TextArea onChange={onInputChange} placeholder="what did you expect to see?" value={formData.message} />
      </Field>

      <InlineSwitch
        label="Can we access your instance?"
        value={formData.accessChecked}
        onChange={onAccessChange}
        showLabel={true}
        transparent={true}
      />
      <InlineSwitch
        label="Can we contact you?"
        value={formData.contactChecked}
        onChange={onContactChange}
        showLabel={true}
        transparent={true}
      />

      <Field label="If you want to be contacted about this feedback, complete your email below">
        <Input onChange={onEmailChange} placeholder="your email" value={formData.reporterEmail} />
      </Field>

      <Stack direction={'column'}>
        <Button onClick={onTakeScreenshot} icon="camera" variant="secondary">
          Take Screenshot
        </Button>

        {formData.screenshot && <canvas ref={canvasRef}></canvas>}

        <Button type="submit" onClick={onSubmit}>
          Submit feedback
        </Button>
      </Stack>
    </Stack>
  );
};
