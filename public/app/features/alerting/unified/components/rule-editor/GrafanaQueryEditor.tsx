import { AlertingQueryEditor } from 'app/features/alerting/components/AlertingQueryEditor';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import React, { FC } from 'react';

interface Props {
  value?: GrafanaQuery[];
  onChange: (value: GrafanaQuery[]) => void;
}

// @TODO replace with actual query editor once it's done
export const GrafanaQueryEditor: FC<Props> = ({ value, onChange }) => {
  return <AlertingQueryEditor queries={value ?? []} onChange={onChange} />;
};
