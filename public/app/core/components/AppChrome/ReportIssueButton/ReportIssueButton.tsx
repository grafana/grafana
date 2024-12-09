import FeedbackPlus from 'feedbackplus';
import { useState } from 'react';

import { FeatureState } from '@grafana/data';
import { ToolbarButton, Drawer, Stack, FeatureBadge, Icon } from '@grafana/ui';

import { DrawerContents } from './FeedbackDrawerContents';
import { ScreenShotEditModal } from './ScreenShotEditModal';
import { FeedbackFormData } from './types';

export const ReportIssueButton = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScreenshotEditModalOpen, setIsScreenshotEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    message: '',
    screenshot: '',
    imageType: '',
    reporterEmail: '',
    accessChecked: false,
    width: 0,
    height: 0,
    bitmap: {} as ImageBitmap,
  });
  const feedbackPlus = new FeedbackPlus();

  return (
    <>
      <ToolbarButton
        iconOnly
        icon={'bug'}
        isOpen={isDrawerOpen}
        aria-label="Report Issue"
        onClick={() => setIsDrawerOpen(true)}
      />
      {isDrawerOpen && (
        <Drawer
          title="Send feedback to Grafana"
          size="md"
          onClose={() => setIsDrawerOpen(false)}
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
            setIsDrawerOpen={setIsDrawerOpen}
            setFormData={setFormData}
            formData={formData}
            feedbackPlus={feedbackPlus}
            setIsScreenshotEditModalOpen={setIsScreenshotEditModalOpen}
          />
        </Drawer>
      )}
      <ScreenShotEditModal
        isScreenshotEditModalOpen={isScreenshotEditModalOpen}
        feedbackPlus={feedbackPlus}
        setFormData={setFormData}
        formData={formData}
        setIsScreenshotEditModalOpen={setIsScreenshotEditModalOpen}
        setIsDrawerOpen={setIsDrawerOpen}
      />
    </>
  );
};

/*
  TODO:
  - fix "any" types
  - move the complicated annotation logic to a separate file
  - add tests
  - uninstall html2canvas since we're not using it anymore
  - we're saving the screenshot data in state as a string, and as a bitmap, probably we should just use bitmap and convert it when we make the network request
  - add a highlight feature
  - let user make multiple edits to a screenshot (you can kind of do this already by saving and editing multiple times)
*/
