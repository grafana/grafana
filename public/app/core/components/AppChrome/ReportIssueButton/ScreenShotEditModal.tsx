import { useCallback, useRef, useState, MouseEvent, useEffect } from 'react';

import { Button, Modal } from '@grafana/ui';
import { extractImageTypeAndData } from 'app/features/feedback/screenshot-encode';

import { FeedbackFormData } from './types';
import { isCanvas } from './utils';

export const ScreenShotEditModal = ({
  isScreenshotEditModalOpen,
  feedbackPlus,
  setFormData,
  formData,
  setIsScreenshotEditModalOpen,
  setIsDrawerOpen,
}: {
  isScreenshotEditModalOpen: boolean;
  feedbackPlus: any;
  setFormData: (fd: FeedbackFormData) => void;
  formData: FeedbackFormData;
  setIsScreenshotEditModalOpen: (isOpen: boolean) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hideToolRef = useRef<HTMLDivElement>(null);
  const [isInEditMode, setIsInEditMode] = useState(false);
  const [isInTheMiddleOfHiding, setIsInTheMiddleOfHiding] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);

  const drawImage = useCallback(
    (
      { bitmap, width, height }: { bitmap: HTMLImageElement; width: number; height: number },
      canvasRef: React.RefObject<HTMLCanvasElement>
    ) => {
      const canvas = canvasRef.current;

      if (canvas && isCanvas(canvas)) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fixedWidth = 700;
          const aspectRatio = height / width;
          const proportionalHeight = fixedWidth * aspectRatio;
          canvas.width = fixedWidth;
          canvas.height = proportionalHeight;

          ctx.drawImage(bitmap, 0, 0, fixedWidth, proportionalHeight);
        }
      }
    },
    []
  );

  // ideally we could just use "showEditDialog from feedbackPlus, but it doesn't seem to work"
  // implementing a similar thing just for hide
  const hide = () => {
    if (isInEditMode) {
      setIsInEditMode(false);
      onDone();
    } else {
      setIsInEditMode(true);
    }
    // add mouseDown, mousemove,  listener to canvas
    // on done, edit the clone and return that
    // then remove old and draw new image?
  };

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
      highlightElem.toggleAttribute('unsaved-edit');
      // todo we should really be cloning and appending these elements dynamically (or however the react-y way to do this is that way you can have mulitiple edits)
      // canvasContainer.appendChild(highlightElem);
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
    drawImage({ bitmap: formData.bitmap, width: formData.width, height: formData.height }, canvasRef);
  }, [formData, drawImage, feedbackPlus]);

  const save = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dataURL = canvas.toDataURL('image/png');
        const imageData = extractImageTypeAndData(dataURL);
        if (imageData) {
          setFormData({ ...formData, screenshot: imageData.data, imageType: imageData.type });
        }
      }
    }
    setIsScreenshotEditModalOpen(false);
    setIsDrawerOpen(true);
  };

  return (
    <Modal title="Edit Screenshot" isOpen={isScreenshotEditModalOpen} onDismiss={() => setIsDrawerOpen(false)}>
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
