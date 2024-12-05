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
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hideToolRef = useRef<HTMLDivElement>(null);
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [isInTheMiddleOfHiding, setIsInTheMiddleOfHiding] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

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

  // ideally we could just use "showEditDialog from feedbackPlus, but it doesn't seem to work"
  // implementing a similar thing just for hide
  const hide = () => {
    setIsInEditMode(true);
    // add mouseDown, mousemove,  listener to canvas
    // on done, edit the clone and return that
    // then remove old and draw new image?
  };

  // when mousedown create a new element to hide things and set starting top and left and append it to the canvas.
  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isInEditMode && e && canvasContainerRef.current && hideToolRef.current) {
      setIsInTheMiddleOfHiding(true);
      const canvasContainer = canvasContainerRef.current;
      const isHighlight = false; // at somepoint could explore highlight
      const highlightElem = hideToolRef.current;
      const x = e.pageX;
      const y = e.pageY;
      const offset = canvasContainerRef.current.getBoundingClientRect();
      const [realX, realY] = [
        x - offset.left + canvasContainer.scrollLeft - (isHighlight ? 5 : 0),
        y - offset.top + canvasContainer.scrollTop - (isHighlight ? 5 : 0),
      ];
      setStartX(realX);
      setStartY(realY);
      highlightElem.style.top = realY + 'px';
      highlightElem.style.left = realX + 'px';
      canvasContainer.appendChild(highlightElem);
    }
  };
  // when mouse move, set width and height (based on boundingClientRect) of the element to hide things
  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (isInEditMode && isInTheMiddleOfHiding) {
      const highlightElem = hideToolRef.current;
      const canvasContainer = canvasContainerRef.current;
      const isHighlight = false; // at somepoint could explore highlight

      if (highlightElem && canvasContainer) {
        e.preventDefault();

        const offset = canvasContainer.getBoundingClientRect();
        const x = e.pageX - offset.left + canvasContainer.scrollLeft - (isHighlight ? 5 : 0);
        const y = e.pageY - offset.top + canvasContainer.scrollTop - (isHighlight ? 5 : 0);
        const Xdiff = x - startX;
        const Ydiff = y - startY;
        if (Xdiff < 0) {
          highlightElem.style.left = startX + Xdiff + 'px';
          highlightElem.style.width = startX - x + 'px';
        } else {
          highlightElem.style.left = startX + 'px';
          highlightElem.style.width = Xdiff + 'px';
        }
        if (Ydiff < 0) {
          highlightElem.style.top = startY + Ydiff + 'px';
          highlightElem.style.height = startY - y + 'px';
        } else {
          highlightElem.style.top = startY + 'px';
          highlightElem.style.height = Ydiff + 'px';
        }
      }
    }
  };

  const onMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    setIsInTheMiddleOfHiding(false);
    setStartX(0);
    setStartY(0);
  };

  useEffect(() => {
    drawImage({ bitmap, width, height }, canvasRef);
  }, [bitmap, drawImage, feedbackPlus, height, width]);

  return (
    <Modal title="title" isOpen={isOpen}>
      <div ref={canvasContainerRef}>
        <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />
      </div>
      <div
        ref={hideToolRef}
        style={{
          position: 'absolute',
          backgroundColor: 'red',
        }}
      ></div>

      <Modal.ButtonRow>
        <Button onClick={hide}>Hide</Button>
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
    - save the edited screenshot
    - fix the offset issue when hiding
    - add a done button for hiding
    - fix the scroll issue inside the widget
    - add a title to the modal
    - close drodown on screenshot, and reopen after done
  - make dropdown cooler looking
*/
