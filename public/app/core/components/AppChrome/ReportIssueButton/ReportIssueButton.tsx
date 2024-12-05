import FeedbackPlus from 'feedbackplus';
// import html2canvas from 'html2canvas';
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react';

import { Dropdown, ToolbarButton, Button, Stack, Menu, Modal } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { getDiagnosticData } from '../../../../features/feedback/diagnostic-data';
// import { canvasToBase64String, extractImageTypeAndData } from '../../../../features/feedback/screenshot-encode';

export interface Props {}

const ScreenShotEditModal = ({
  isOpen,
  bitmap,
  width,
  height,
  feedbackPlus,
}: {
  isOpen: boolean;
  bitmap: HTMLImageElement;
  width: number;
  height: number;
  feedbackPlus: any;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drawImage = (
    { bitmap, width, height }: { bitmap: HTMLImageElement; width: number; height: number },
    canvasRef: React.RefObject<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;

    if (canvas && isCanvas(canvas)) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 800;
        canvas.height = 800;
        const hRatio = canvas.width / width;
        const vRatio = canvas.height / height;
        const ratio = Math.min(hRatio, vRatio);
        ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, width * ratio, height * ratio);
      }
    }
  };

  // TODO: edit is creates another modal underneath and below this one
  // this feels maybe like it's just a real css nightmare but maybe one that can be solved
  // I think there are html ids that we can reference: https://github.com/puffinsoft/feedbackplus/blob/master/docs/demos/script.js
  const edit = () => {
    feedbackPlus.showEditDialog(
      bitmap,
      function (canvas: any) {
        // user completed edit
        FeedbackPlus.canvasToBitmap(canvas).then(
          (result: { bitmap: HTMLImageElement; width: number; height: number }) => {
            drawImage(result, canvasRef);
            feedbackPlus.closeEditDialog();
          }
        );
      },
      function () {
        // user cancelled edit
        feedbackPlus.closeEditDialog();
      }
    );
  };

  useEffect(() => {
    drawImage({ bitmap, width, height }, canvasRef);
  }, [bitmap, drawImage, feedbackPlus, height, width]);

  return (
    <Modal title="title" isOpen={isOpen}>
      <canvas ref={canvasRef} />
      <Modal.ButtonRow>
        <Button onClick={edit}>Edit</Button>
        <Button>Save</Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const MenuActions = () => {
  const [formData, setFormData] = useState({
    message: '',
    screenshot: '',
    imageType: '',
    width: 0,
    height: 0,
    bitmap: {} as HTMLImageElement,
  });
  const feedbackPlus = new FeedbackPlus();
  const [isScreenshotEditoModalOpen, setIsScreenshotEditoModalOpen] = useState(false);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData({ ...formData, message: e.target.value });
  };

  const onTakeScreenshot = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // const element = document.body; // TODO: choose a different selector?
    // if (element) {
    //   const canvas = await html2canvas(element, { backgroundColor: null });

    //   const encoded = await canvasToBase64String(canvas);
    //   if (encoded && typeof encoded === 'string') {
    //     const screenshot = extractImageTypeAndData(encoded);
    //     if (screenshot) {
    //       setFormData({ ...formData, screenshot: screenshot.data, imageType: screenshot.type });
    //     }
    //   }
    // }

    feedbackPlus
      .capture()
      .then(({ bitmap, width, height }: { bitmap: HTMLImageElement; width: number; height: number }) => {
        setFormData({ ...formData, bitmap, width, height });
        setIsScreenshotEditoModalOpen(true);
        //       feedbackPlus.showEditDialog(bitmap, function (canvas: any) {
        //         console.log("here??")
        //         // user completed edit
        //         FeedbackPlus.canvasToBitmap(canvas).then(({ bitmap }: { bitmap: any }) => {
        //           canvas.getContext("2d").drawImage(bitmap, 0, 0);
        //           feedbackPlus.closeEditDialog();
        //         });
        //       }, function () {
        //         // user cancelled edit
        //         feedbackPlus.closeEditDialog();
        //       });
      });
  };

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    const diagnosticData = await getDiagnosticData();

    const feedback: Spec = {
      message: formData.message,
      screenshot: formData.screenshot,
      imageType: formData.imageType,
      diagnosticData,
    };

    const feedbackApi = getFeedbackAPI();
    await feedbackApi.createFeedback(feedback);
  };

  const stopAutoClose = (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
    e.preventDefault();
    e.stopPropagation();
  };

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
        <ScreenShotEditModal
          isOpen={isScreenshotEditoModalOpen}
          bitmap={formData.bitmap}
          width={formData.width}
          height={formData.height}
          feedbackPlus={feedbackPlus}
        />
      </div>
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

function isCanvas(obj: HTMLCanvasElement | HTMLElement): obj is HTMLCanvasElement {
  return obj && obj.tagName === 'CANVAS';
}

/* 
  TODO:
  - see if we can get annotations to work
  - make it stylistically pretty
*/
