import { ComponentProps, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Drawer } from '@grafana/ui';
import { Permissions } from 'app/core/components/AccessControl';

type ButtonProps = { onClick: () => void };

type BaseProps = Pick<ComponentProps<typeof Permissions>, 'resource' | 'resourceId'> & {
  resourceName?: string;
  title?: string;
};

type Props = BaseProps & {
  renderButton?: (props: ButtonProps) => JSX.Element;
};

/**
 * Renders just the drawer containing permissions management for the resource.
 *
 * Useful for manually controlling the state/display of the drawer when you need to render the
 * controlling button within a dropdown etc.
 */
export const ManagePermissionsDrawer = ({
  resourceName,
  title,
  onClose,
  ...permissionsProps
}: BaseProps & Pick<ComponentProps<typeof Drawer>, 'onClose'>) => {
  const defaultTitle = t('alerting.manage-permissions.title', 'Manage permissions');
  return (
    <Drawer onClose={onClose} title={title || defaultTitle} subtitle={resourceName}>
      <Permissions {...permissionsProps} canSetPermissions />
    </Drawer>
  );
};

/** Default way to render the button for "manage permissions" */
const DefaultButton = ({ onClick }: ButtonProps) => {
  return (
    <Button variant="secondary" onClick={onClick} icon="unlock">
      <Trans i18nKey="alerting.manage-permissions.button">Manage permissions</Trans>
    </Button>
  );
};

/**
 * Renders a button that opens a drawer with the permissions editor.
 *
 * Provides capability to render button as custom component, and manages open/close state internally
 */
export const ManagePermissions = ({ resource, resourceId, resourceName, title, renderButton }: Props) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const closeDrawer = () => setShowDrawer(false);
  const openDrawer = () => setShowDrawer(true);

  return (
    <>
      {renderButton ? renderButton({ onClick: openDrawer }) : <DefaultButton onClick={openDrawer} />}
      {showDrawer && (
        <ManagePermissionsDrawer
          resource={resource}
          resourceId={resourceId}
          resourceName={resourceName}
          title={title}
          onClose={closeDrawer}
        />
      )}
    </>
  );
};
