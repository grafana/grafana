import FeedbackPlus from 'feedbackplus';
import { useState } from 'react';

import { ToolbarButton, Drawer, Stack, FeatureBadge, Icon } from '@grafana/ui';

import { DrawerContents } from './FeedbackDrawerContents';
import { ScreenShotEditModal } from './ScreenShotEditModal';
import { FeedbackFormData } from './types';
import { FeatureState } from '@grafana/data';

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
        <Drawer
          title="Send feedback to Grafana"
          size="md"
          onClose={() => setIsOpen(false)}
          subtitle={
            <Stack direction="column" gap={1}>
              <Stack direction="row" gap={1}>
                <FeatureBadge featureState={FeatureState.beta} />
                <a
                  href="https://grafana.com/docs/grafana/latest/troubleshooting/"
                  target="blank"
                  className="external-link"
                  rel="noopener noreferrer"
                >
                  Troubleshooting docs <Icon name="external-link-alt" />
                </a>
              </Stack>
              <span className="muted">
                To request troubleshooting help, you can create a support ticket from this form, which will include some
                basic information.
              </span>
            </Stack>
          }
        >
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
  - make dropdown cooler looking
  - add a cancel button to delete screenshot if the user doesn't like it
  - make this file easier to look at without crying, add prop types, fix "any" types
  - add a highlight feature
  - let user make multiple edits to a screenshot (you can kind of do this already by saving and editing multiple times)
*/
