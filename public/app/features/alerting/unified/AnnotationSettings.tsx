import { Stack } from '@grafana/ui';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AnnotationPolicySettings } from './components/settings/AnnotationPolicySettings';
import { SettingsProvider, useSettings } from './components/settings/SettingsContext';
import { useSettingsPageNav } from './settings/navigation';
import { withPageErrorBoundary } from './withPageErrorBoundary';

function AnnotationSettingsPage() {
  return (
    <SettingsProvider>
      <AnnotationSettingsContent />
    </SettingsProvider>
  );
}

function AnnotationSettingsContent() {
  const { isLoading } = useSettings();
  const { navId, pageNav } = useSettingsPageNav();

  return (
    <AlertingPageWrapper navId={navId} isLoading={isLoading} pageNav={pageNav}>
      <Stack direction="column" gap={2}>
        <AnnotationPolicySettings />
      </Stack>
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AnnotationSettingsPage);
