import { FC } from 'react';

import { HorizontalGroup, LinkButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export interface Props {
  canEdit?: boolean;
}

export const ListActions: FC<Props> = ({ canEdit }) => {
  const actionUrl = (type: string) => {
    return `calculated-fields/${type}`;
  };

  return (
    <HorizontalGroup spacing="md" align="center">
      {canEdit && (
        <LinkButton href={actionUrl('new')} onClick={() => {}}>
          <Trans i18nKey="bmc.calc-fields.new-field">New Calculated Field</Trans>
        </LinkButton>
      )}
    </HorizontalGroup>
  );
};
