import { Drawer, Text } from '@grafana/ui';

import { SaveProvisionedResourceForm, type SaveProvisionedResourceFormProps } from './SaveProvisionedResourceForm';

export interface SaveProvisionedResourceDrawerProps extends SaveProvisionedResourceFormProps {
  /** Header shown at the top of the drawer (e.g. "Save provisioned playlist"). */
  drawerTitle: string;
}

/**
 * {@link SaveProvisionedResourceForm} wrapped in the standard drawer chrome.
 *
 * Use this for the common case of committing a repository-managed resource from a drawer (the
 * resource title becomes the subtitle). If you need different chrome, render the form directly
 * instead. Used by playlists today; library panels and other k8s-style resources can reuse it.
 */
export function SaveProvisionedResourceDrawer({ drawerTitle, ...formProps }: SaveProvisionedResourceDrawerProps) {
  return (
    <Drawer
      title={
        <Text variant="h3" element="h2">
          {drawerTitle}
        </Text>
      }
      subtitle={formProps.title}
      onClose={() => formProps.onDismiss?.()}
    >
      <SaveProvisionedResourceForm {...formProps} />
    </Drawer>
  );
}
