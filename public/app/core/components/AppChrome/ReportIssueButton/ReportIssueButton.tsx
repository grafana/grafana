import FeedbackPlus from 'feedbackplus';
import { useState } from 'react';

import { ToolbarButton, Drawer } from '@grafana/ui';

import { DrawerContents } from './FeedbackDrawerContents';
import { ScreenShotEditModal } from './ScreenShotEditModal';
import { FeedbackFormData } from './types';



export const ReportIssueButton = () => {
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



/* 
  TODO:
  - fix width/ratio of thumbnail in preview (also weirdly pixelated?? are we losing image quality in converting it twice?)
  - add a cancel button to delete screenshot if the user doesn't like it
  - make dropdown cooler looking
  - make this file easier to look at without crying, add prop types, fix "any" types
  - let user make multiple edits to a screenshot
  - add a highlight feature
*/
