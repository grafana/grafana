import { Drawer, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

const drawerSubtitle = (
  <Trans i18nKey="role-picker.title.description">
    Assign roles to users to ensure granular control over access to Grafana&lsquo;s features and resources. Find out
    more in our{' '}
    <TextLink
      external
      href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
    >
      documentation
    </TextLink>
    .
  </Trans>
);

export interface Props {
  user: {
    name: string;
    login: string;
  };
  onClose: () => void;
}

export const RolePickerDrawer = ({ onClose, user }: Props) => {
  return (
    <Drawer title={user.name || user.login} subtitle={drawerSubtitle} onClose={onClose}>
      <></>
    </Drawer>
  );
};
