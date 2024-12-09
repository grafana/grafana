import pica from 'pica';
import { useRef, useState, MouseEvent, useEffect } from 'react';

import { Button, Modal } from '@grafana/ui';
import { extractImageTypeAndData } from 'app/features/feedback/screenshot-encode';

import { FeedbackFormData } from './types';
import { isCanvas } from './utils';

type ScreenshotEditModalProps = {
  isScreenshotEditModalOpen: boolean;
  feedbackPlus: any;
  setFormData: (fd: FeedbackFormData) => void;
  formData: FeedbackFormData;
  setIsScreenshotEditModalOpen: (isOpen: boolean) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
};

export const ScreenShotEditModal = ({
  isScreenshotEditModalOpen,
  feedbackPlus,
  setFormData,
  formData,
  setIsScreenshotEditModalOpen,
  setIsDrawerOpen,
}: ScreenshotEditModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hideToolRef = useRef<HTMLDivElement>(null);
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [isInTheMiddleOfHiding, setIsInTheMiddleOfHiding] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  const hide = () => {
    if (isInEditMode) {
      setIsInEditMode(false);
      onDone();
    } else {
      setIsInEditMode(true);
    }
  };

  // Takes the overlayed hidden blocks and edits the original canvas to have the same blocks built into it
  // heavily inspired by https://github.com/puffinsoft/feedbackplus/blob/674c4cd5a23684030a77fa2cbae033c13e567026/src/feedbackplus.js#L220
  const onDone = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (hideToolRef.current) {
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#FCC934';
          ctx.fillStyle = 'red';
          let hideStyles = hideToolRef.current.style;
          const topNum = +hideStyles.top.slice(0, -2);
          const leftNum = +hideStyles.left.slice(0, -2);
          const widthNum = +hideStyles.width.slice(0, -2);
          const heightNum = +hideStyles.height.slice(0, -2);

          ctx.fillRect(leftNum, topNum, widthNum, heightNum);
        }
      }
    }
  };

  // On click of the canvas, take the hidden block and move it to the mouse position
  // heavily inspired by https://github.com/puffinsoft/feedbackplus/blob/674c4cd5a23684030a77fa2cbae033c13e567026/src/feedbackplus.js#L146
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
    }
  };

  // when the mouse is moving after clicking but before unclicking,
  // set width and height of the hidden element based on the mouse position
  // heavily inspired by https://github.com/puffinsoft/feedbackplus/blob/674c4cd5a23684030a77fa2cbae033c13e567026/src/feedbackplus.js#L171
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

  //
  const onMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    setIsInTheMiddleOfHiding(false);
    setStartX(0);
    setStartY(0);
  };

  // save the edited (or not edited) screenshot to the feedback form
  const save = async () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dataURL = canvas.toDataURL('image/png');
        const imageData = extractImageTypeAndData(dataURL);
        const newBitmap = await createImageBitmap(canvas);
        if (imageData) {
          setFormData({
            ...formData,
            screenshot: imageData.data,
            imageType: imageData.type,
            bitmap: newBitmap,
            width: canvas.width,
            height: canvas.height,
          });
        }
      }
    }
    setIsScreenshotEditModalOpen(false);
    setIsDrawerOpen(true);
  };

  // draw the screenshot onto the canvas
  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas && isCanvas(canvas)) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const fixedWidth = 650;
        const aspectRatio = formData.height / formData.width;
        const proportionalHeight = fixedWidth * aspectRatio;
        canvas.width = fixedWidth;
        canvas.height = proportionalHeight;
        pica().resize(formData.bitmap, canvas);
      }
    }
  }, [formData, feedbackPlus]);

  return (
    <Modal
      title="Edit Screenshot"
      isOpen={isScreenshotEditModalOpen}
      onDismiss={() => setIsScreenshotEditModalOpen(false)}
    >
      <div>
        {isInEditMode
          ? 'Click and drag to hide sensitive information then press Finished Editing'
          : 'Click Edit button to hide sensitive information, or press save to attach screenshot to feedback form'}
      </div>
      <div ref={canvasContainerRef} style={{ position: 'relative' }}>
        <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />
        <div
          ref={hideToolRef}
          style={{
            position: 'absolute',
            backgroundColor: 'red',
          }}
        ></div>
      </div>
      <Modal.ButtonRow>
        <Button onClick={hide}>{isInEditMode ? 'Finished Editing' : 'Edit'}</Button>
        <Button onClick={save} disabled={isInEditMode}>
          Save
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
