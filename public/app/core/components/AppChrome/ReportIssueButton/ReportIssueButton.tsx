import FeedbackPlus from 'feedbackplus';
import { ChangeEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ToolbarButton, Button, Stack, Modal, Drawer, Label, TextArea, Checkbox } from '@grafana/ui';
import { extractImageTypeAndData } from 'app/features/feedback/screenshot-encode';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';
import { getDiagnosticData } from '../../../../features/feedback/diagnostic-data';

export interface Props {}

type FeedbackFormData = {
  message: string;
  screenshot: string;
  imageType: string;
  reporterEmail: string;
  accessChecked: boolean;
  contactChecked: boolean;
  width: number;
  height: number;
  bitmap: HTMLImageElement;
};

const ScreenShotEditModal = ({
  isOpen,
  feedbackPlus,
  setFormData,
  formData,
  setIsScreenshotEditModalOpen,
  setIsDropdownOpen,
}: {
  isOpen: boolean;
  feedbackPlus: any;
  setFormData: (fd: FeedbackFormData) => void;
  formData: FeedbackFormData;
  setIsScreenshotEditModalOpen: (isOpen: boolean) => void;
  setIsDropdownOpen: (isOpen: boolean) => void;
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
          canvas.width = 700;
          const hRatio = canvas.width / width;
          const vRatio = canvas.height / height;
          const ratio = Math.min(hRatio, vRatio);
          ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, width * ratio, height * ratio);
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
          console.log('is this happening????');
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#FCC934';
          ctx.fillStyle = 'green';
          let hideStyles = hideToolRef.current.style;
          const topNum = +hideStyles.top.slice(0, -2);
          const leftNum = +hideStyles.left.slice(0, -2);
          const widthNum = +hideStyles.width.slice(0, -2);
          const heightNum = +hideStyles.height.slice(0, -2);
          // canvas.width = 800;
          // canvas.height = 800;
          // const hRatio = canvas.width / width;
          // const vRatio = canvas.height / height;
          // const ratio = Math.min(hRatio, vRatio);
          // ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, width * ratio, height * ratio);
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
    setIsDropdownOpen(true);
  };

  return (
    <Modal title="Edit Screenshot" isOpen={isOpen}>
      <div>
        {isInEditMode
          ? 'Click and drag to hide sensitive information then press Finished Editing'
          : 'Click Edit button to hide sensitive information, or press save to attach screenshot to feedback form'}
      </div>
      <div ref={canvasContainerRef}>
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

type DrawerContentsProps = {
  setIsOpen: (isOpen: boolean) => void;
  setFormData: (fd: FeedbackFormData) => void;
  setIsScreenshotEditModalOpen: (isOpen: boolean) => void;
  feedbackPlus: any;
  formData: FeedbackFormData;
};
const DrawerContents = ({
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

  const onEmailChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
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
        canvas.width = 200;
        // const hRatio = canvas.width / formData.width;
        // const vRatio = canvas.height / formData.height;
        // const ratio = Math.min(hRatio, vRatio);
        // ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, width * ratio, height * ratio);
        const image = new Image();
        image.onload = function () {
          ctx.drawImage(image, 0, 0);
        };
        image.src = 'data:image/' + formData.imageType + ';base64,' + formData.screenshot;
      }
    }
  }, [formData.height, formData.imageType, formData.screenshot, formData.width]);

  return (
    <Stack gap={2} direction={'column'}>
      <Label>
        Tell us what happened:
        <TextArea onChange={onInputChange} placeholder="what did you expect to see?" />
      </Label>
      <Checkbox label="Can we access your instance?" value={formData.accessChecked} onChange={onAccessChange} />
      <Checkbox label="Can we contact you?" value={formData.contactChecked} onChange={onContactChange} />
      <Label>
        If so, what is your email?
        <TextArea onChange={onEmailChange} placeholder="your email" />
      </Label>
      <Button onClick={onTakeScreenshot}>Take Screenshot</Button>
      {formData.screenshot && <canvas ref={canvasRef}></canvas>}
      <Button type="submit" onClick={onSubmit}>
        Submit feedback
      </Button>
    </Stack>
  );
};

export const ReportIssueButton = ({}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScreenshotEditModalOpen, setIsScreenshotEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    message: '',
    screenshot: '',
    imageType: '',
    reporterEmail: '',
    accessChecked: false,
    contactChecked: false,
    width: 0,
    height: 0,
    bitmap: {} as HTMLImageElement,
  });
  const feedbackPlus = new FeedbackPlus();

  return (
    <>
      <ToolbarButton iconOnly icon={'bug'} isOpen={isOpen} aria-label="Report Issue" onClick={() => setIsOpen(true)} />
      {isOpen && (
        <Drawer title="Send feedback to Grafana" size="md" onClose={() => setIsOpen(false)}>
          <DrawerContents
            setIsOpen={setIsOpen}
            setFormData={setFormData}
            formData={formData}
            feedbackPlus={feedbackPlus}
            setIsScreenshotEditModalOpen={setIsScreenshotEditModalOpen}
          />
        </Drawer>
      )}
      <ScreenShotEditModal
        isOpen={isScreenshotEditModalOpen}
        feedbackPlus={feedbackPlus}
        setFormData={setFormData}
        formData={formData}
        setIsScreenshotEditModalOpen={setIsScreenshotEditModalOpen}
        setIsDropdownOpen={setIsOpen}
      />
    </>
  );
};

function isCanvas(obj: HTMLCanvasElement | HTMLElement): obj is HTMLCanvasElement {
  return obj && obj.tagName === 'CANVAS';
}

/* 
  TODO:
  - fix that form fields getting back to default after screenshot is taken
  - fix the offset issue when actively hiding (seems to work when saving? why is the red preview box off??)
  - fix width/ratio of thumbnail in preview (also weirdly pixelated?? are we losing image quality in converting it twice?)
  - add a cancel button to delete screenshot if the user doesn't like it
  - make dropdown cooler looking
  - make this file easier to look at without crying, break it up into smaller components, add prop types, fix "any" types
  - let user make multiple edits to a screenshot
  - add a highlight feature
*/
